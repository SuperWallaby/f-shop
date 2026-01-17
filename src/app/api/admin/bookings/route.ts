import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../_utils/http";
import { requireAdmin } from "../../_utils/adminAuth";
import { createBookingSchema } from "@/lib/schemas";
import { sendBookingCreatedEmail } from "@/lib/email";
import type { BookingDb } from "@/lib/db";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { generateBookingCode6 } from "@/lib/bookingCode";
import { acquireExclusiveLocks } from "@/lib/exclusiveLocks";
import { sendAdminWhatsAppNotification, sendBookingConfirmedWhatsApp } from "@/lib/twilioWhatsApp";

class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const body = await req.json().catch(() => null);
    const parsed = createBookingSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const { slotId, name, email, whatsapp } = parsed.data;
    const slotObjectId = ObjectId.isValid(slotId) ? new ObjectId(slotId) : null;
    if (!slotObjectId) return jsonError("Invalid slotId", 400);

    const { timeSlots, bookings, items, exclusiveLocks } = await getCollections();
    const now = new Date();

    const existingSlot = await timeSlots.findOne({ _id: slotObjectId });
    if (!existingSlot) return jsonError("Slot not found", 404);
    if (existingSlot.cancelled) return jsonError("Slot is cancelled", 409);

    const item = await items.findOne({ _id: existingSlot.itemId });
    if (!item || !item.active) return jsonError("Item not found or inactive", 409);
    const exclusiveKey = (item.exclusiveKey ?? "").trim();
    const effectiveCapacity = item.capacity;

    let insertedBuckets: number[] = [];
    if (exclusiveKey) {
      const conflict = await bookings.findOne(
        {
          status: "confirmed",
          exclusiveKey,
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
        exclusiveKey,
        dateKey: existingSlot.dateKey,
        itemId: item._id!,
        startMin: existingSlot.startMin,
        endMin: existingSlot.endMin,
        now,
      });
      if (!lockRes.ok) {
        return jsonError("This time is already booked", 409);
      }
      insertedBuckets = lockRes.insertedBuckets;
    }

    const updatedSlot = await timeSlots.findOneAndUpdate(
      {
        _id: slotObjectId,
        cancelled: false,
        itemId: item._id,
        $expr: { $lt: ["$bookedCount", effectiveCapacity] },
      },
      { $inc: { bookedCount: 1 }, $set: { updatedAt: now } },
      { returnDocument: "after" }
    );

    if (!updatedSlot) {
      if (exclusiveKey && insertedBuckets.length > 0) {
        await exclusiveLocks.deleteMany({
          exclusiveKey,
          dateKey: existingSlot.dateKey,
          itemId: item._id!,
          bucket: { $in: insertedBuckets },
        });
      }
      return jsonError("Slot is full or unavailable", 409);
    }

    try {
      const bookingDoc: BookingDb = {
        code: generateBookingCode6(),
        slotId: updatedSlot._id,
        detached: false,
        itemId: item._id,
        exclusiveKey: exclusiveKey || undefined,
        name,
        email,
        whatsapp,
        status: "confirmed" as const,
        createdAt: now,
        dateKey: updatedSlot.dateKey,
        startMin: updatedSlot.startMin,
        endMin: updatedSlot.endMin,
        businessTimeZone: BUSINESS_TIME_ZONE,
        capacityAtBooking: effectiveCapacity,
      };

      let result: { insertedId: ObjectId } | null = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          if (attempt > 0) bookingDoc.code = generateBookingCode6();
          result = await bookings.insertOne(bookingDoc);
          break;
        } catch (e) {
          if (
            e &&
            typeof e === "object" &&
            "code" in e &&
            (e as { code?: number }).code === 11000
          ) {
            const msg = (e as { message?: string }).message ?? "";
            if (msg.includes("uniq_code")) continue;
            throw e;
          }
          throw e;
        }
      }
      if (!result) throw new Error("Failed to allocate booking code");

      try {
        await sendBookingCreatedEmail({
          to: email,
          name,
          classTypeName: item.name,
          whatsapp,
          bookingCode: bookingDoc.code,
          dateKey: updatedSlot.dateKey,
          startMin: updatedSlot.startMin,
          endMin: updatedSlot.endMin,
          businessTimeZone: BUSINESS_TIME_ZONE,
        });
      } catch {
        // ignore
      }

      // WhatsApp best-effort
      try {
        await Promise.all([
          sendBookingConfirmedWhatsApp({
            to: whatsapp,
            name,
            classTypeName: item.name,
            bookingCode: bookingDoc.code,
            dateKey: updatedSlot.dateKey,
            startMin: updatedSlot.startMin,
            endMin: updatedSlot.endMin,
            businessTimeZone: BUSINESS_TIME_ZONE,
          }).catch(() => {}),
          sendAdminWhatsAppNotification({
            kind: "booking_confirmed",
            name,
            email,
            whatsapp,
            bookingCode: bookingDoc.code,
            classTypeName: item.name,
            dateKey: updatedSlot.dateKey,
            startMin: updatedSlot.startMin,
            endMin: updatedSlot.endMin,
            businessTimeZone: BUSINESS_TIME_ZONE,
          }).catch(() => {}),
        ]);
      } catch {
        // ignore
      }

      return jsonOk({
        bookingId: result.insertedId.toHexString(),
        bookingCode: bookingDoc.code,
        slotId: updatedSlot._id.toHexString(),
      });
    } catch (e) {
      await timeSlots.updateOne(
        { _id: updatedSlot._id, bookedCount: { $gt: 0 } },
        { $inc: { bookedCount: -1 }, $set: { updatedAt: new Date() } }
      );
      if (exclusiveKey && insertedBuckets.length > 0) {
        await exclusiveLocks.deleteMany({
          exclusiveKey,
          dateKey: updatedSlot.dateKey,
          itemId: item._id!,
          bucket: { $in: insertedBuckets },
        });
      }
      throw e;
    }
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.message, e.status, e.details);
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

