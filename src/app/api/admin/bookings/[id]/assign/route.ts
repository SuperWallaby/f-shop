import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../../../_utils/http";
import { requireAdmin } from "../../../../_utils/adminAuth";
import { z } from "zod";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { acquireExclusiveLocks, releaseExclusiveLocksAfterBookingRemoved } from "@/lib/exclusiveLocks";

const assignSchema = z.object({
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
    const parsed = assignSchema.safeParse(body);
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

    if (!booking.detached || booking.slotId) {
      return jsonError("Booking is not detached", 409);
    }

    const existingSlot = await timeSlots.findOne({ _id: slotObjectId });
    if (!existingSlot) return jsonError("Slot not found", 404);
    if (existingSlot.cancelled) return jsonError("Slot is cancelled", 409);

    const item = await items.findOne({ _id: existingSlot.itemId });
    if (!item || !item.active) return jsonError("Item not found or inactive", 409);

    const newExclusiveKey = (item.exclusiveKey ?? "").trim();
    let insertedBuckets: number[] = [];
    if (newExclusiveKey) {
      const conflict = await bookings.findOne(
        {
          status: "confirmed",
          exclusiveKey: newExclusiveKey,
          dateKey: existingSlot.dateKey,
          itemId: { $ne: item._id },
          startMin: { $lt: existingSlot.endMin },
          endMin: { $gt: existingSlot.startMin },
        },
        { projection: { _id: 1 } }
      );
      if (conflict) return jsonError("This time is already booked", 409);

      const lockRes = await acquireExclusiveLocks({
        exclusiveLocks,
        exclusiveKey: newExclusiveKey,
        dateKey: existingSlot.dateKey,
        itemId: item._id!,
        startMin: existingSlot.startMin,
        endMin: existingSlot.endMin,
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
      if (newExclusiveKey && insertedBuckets.length > 0) {
        await exclusiveLocks.deleteMany({
          exclusiveKey: newExclusiveKey,
          dateKey: existingSlot.dateKey,
          itemId: item._id!,
          bucket: { $in: insertedBuckets },
        });
      }
      return jsonError("Slot is full or unavailable", 409);
    }

    const oldExclusiveKey = (booking.exclusiveKey ?? "").trim();
    const oldItemId = booking.itemId;
    const oldDateKey = booking.dateKey;
    const oldStartMin = booking.startMin;
    const oldEndMin = booking.endMin;

    await bookings.updateOne(
      { _id: bookingObjectId },
      {
        $set: {
          slotId: updatedSlot._id,
          detached: false,
          itemId: item._id,
          exclusiveKey: newExclusiveKey || undefined,
          dateKey: updatedSlot.dateKey,
          startMin: updatedSlot.startMin,
          endMin: updatedSlot.endMin,
          businessTimeZone: BUSINESS_TIME_ZONE,
          capacityAtBooking: item.capacity,
        },
        $unset: { detachedAt: "", detachedFromSlotId: "" },
      }
    );

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

    return jsonOk({ assigned: true });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

