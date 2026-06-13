import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../../../_utils/http";
import { requireAdmin } from "../../../../_utils/adminAuth";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { sendBookingRescheduledEmail } from "@/lib/email";
import {
  acquireExclusiveLocks,
  releaseExclusiveLocksAfterBookingRemoved,
} from "@/lib/exclusiveLocks";
import { sendAdminWhatsAppNotification } from "@/lib/twilioWhatsApp";

const rescheduleSchema = z.object({
  slotId: z.string().min(1),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const { id } = await ctx.params;
    const bookingObjectId = ObjectId.isValid(id) ? new ObjectId(id) : null;
    if (!bookingObjectId) return jsonError("Invalid booking id", 400);

    const body = await req.json().catch(() => null);
    const parsed = rescheduleSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const slotObjectId = ObjectId.isValid(parsed.data.slotId)
      ? new ObjectId(parsed.data.slotId)
      : null;
    if (!slotObjectId) return jsonError("Invalid slot id", 400);

    const { bookings, timeSlots, items, exclusiveLocks } = await getCollections();
    const now = new Date();

    const booking = await bookings.findOne({ _id: bookingObjectId });
    if (!booking) return jsonError("Booking not found", 404);
    if (booking.status !== "confirmed") {
      return jsonError("Only confirmed bookings can be rescheduled", 409);
    }

    if (booking.slotId?.equals(slotObjectId)) {
      return jsonError("Booking is already on this session", 409);
    }

    const targetSlot = await timeSlots.findOne({ _id: slotObjectId });
    if (!targetSlot) return jsonError("Slot not found", 404);
    if (targetSlot.cancelled) return jsonError("Slot is cancelled", 409);

    if (!booking.itemId.equals(targetSlot.itemId)) {
      return jsonError("Reschedule must keep the same class type", 409);
    }

    const item = await items.findOne({ _id: targetSlot.itemId });
    if (!item || !item.active) return jsonError("Item not found or inactive", 409);

    const exclusiveKey = (item.exclusiveKey ?? "").trim();
    let insertedBuckets: number[] = [];

    if (exclusiveKey) {
      const conflict = await bookings.findOne(
        {
          status: "confirmed",
          exclusiveKey,
          dateKey: targetSlot.dateKey,
          itemId: { $ne: item._id },
          startMin: { $lt: targetSlot.endMin },
          endMin: { $gt: targetSlot.startMin },
        },
        { projection: { _id: 1 } }
      );
      if (conflict) return jsonError("This time is already booked", 409);

      const lockRes = await acquireExclusiveLocks({
        exclusiveLocks,
        exclusiveKey,
        dateKey: targetSlot.dateKey,
        itemId: item._id!,
        startMin: targetSlot.startMin,
        endMin: targetSlot.endMin,
        now,
      });
      if (!lockRes.ok) return jsonError("This time is already booked", 409);
      insertedBuckets = lockRes.insertedBuckets;
    }

    const updatedSlot = await timeSlots.findOneAndUpdate(
      {
        _id: slotObjectId,
        cancelled: false,
        itemId: item._id,
        $expr: { $lt: ["$bookedCount", item.capacity] },
      },
      { $inc: { bookedCount: 1 }, $set: { updatedAt: now } },
      { returnDocument: "after" }
    );

    if (!updatedSlot) {
      if (exclusiveKey && insertedBuckets.length > 0) {
        await exclusiveLocks.deleteMany({
          exclusiveKey,
          dateKey: targetSlot.dateKey,
          itemId: item._id!,
          bucket: { $in: insertedBuckets },
        });
      }
      return jsonError("Slot is full or unavailable", 409);
    }

    const oldSlotId = booking.slotId ?? null;
    const oldExclusiveKey = (booking.exclusiveKey ?? "").trim();
    const oldItemId = booking.itemId;
    const oldDateKey = booking.dateKey;
    const oldStartMin = booking.startMin;
    const oldEndMin = booking.endMin;

    try {
      const updated = await bookings.updateOne(
        { _id: bookingObjectId, status: "confirmed" },
        {
          $set: {
            slotId: updatedSlot._id,
            detached: false,
            itemId: item._id,
            exclusiveKey: exclusiveKey || undefined,
            dateKey: updatedSlot.dateKey,
            startMin: updatedSlot.startMin,
            endMin: updatedSlot.endMin,
            businessTimeZone: BUSINESS_TIME_ZONE,
            capacityAtBooking: item.capacity,
          },
          $unset: { detachedAt: "", detachedFromSlotId: "" },
        }
      );

      if (!updated.modifiedCount) {
        throw new Error("Booking update failed");
      }

      if (oldSlotId) {
        await timeSlots.updateOne(
          { _id: oldSlotId, bookedCount: { $gt: 0 } },
          { $inc: { bookedCount: -1 }, $set: { updatedAt: now } }
        );
      }

      if (oldExclusiveKey) {
        await releaseExclusiveLocksAfterBookingRemoved({
          exclusiveLocks,
          bookings,
          exclusiveKey: oldExclusiveKey,
          dateKey: oldDateKey,
          itemId: oldItemId,
          startMin: oldStartMin,
          endMin: oldEndMin,
        });
      }

      try {
        await sendBookingRescheduledEmail({
          to: booking.email,
          name: booking.name,
          classTypeName: item.name,
          whatsapp: booking.whatsapp,
          bookingCode: booking.code,
          businessTimeZone: booking.businessTimeZone || BUSINESS_TIME_ZONE,
          previousDateKey: oldDateKey,
          previousStartMin: oldStartMin,
          previousEndMin: oldEndMin,
          dateKey: updatedSlot.dateKey,
          startMin: updatedSlot.startMin,
          endMin: updatedSlot.endMin,
        });
      } catch {
        // best-effort — booking already moved
      }

      try {
        await sendAdminWhatsAppNotification({
          kind: "booking_rescheduled",
          name: booking.name,
          email: booking.email,
          whatsapp: booking.whatsapp,
          bookingCode: booking.code,
          classTypeName: item.name,
          dateKey: updatedSlot.dateKey,
          startMin: updatedSlot.startMin,
          endMin: updatedSlot.endMin,
          businessTimeZone: booking.businessTimeZone || BUSINESS_TIME_ZONE,
          extra: `Previous: ${oldDateKey} ${oldStartMin}-${oldEndMin}`,
        });
      } catch {
        // ignore
      }

      return jsonOk({
        rescheduled: true,
        dateKey: updatedSlot.dateKey,
        startMin: updatedSlot.startMin,
        endMin: updatedSlot.endMin,
        slotId: updatedSlot._id.toHexString(),
      });
    } catch (e) {
      await timeSlots.updateOne(
        { _id: updatedSlot._id, bookedCount: { $gt: 0 } },
        { $inc: { bookedCount: -1 }, $set: { updatedAt: now } }
      );
      if (exclusiveKey && insertedBuckets.length > 0) {
        await exclusiveLocks.deleteMany({
          exclusiveKey,
          dateKey: targetSlot.dateKey,
          itemId: item._id!,
          bucket: { $in: insertedBuckets },
        });
      }
      throw e;
    }
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
