import { NextRequest } from "next/server";
import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireClientReady } from "@/app/api/_utils/clientAuth";
import { jsonError, jsonOk } from "@/app/api/_utils/http";
import { getBookingRulesFromSettings, isSlotBookableByRules } from "@/lib/bookingRules";
import {
  buildCustomerRescheduledMessage,
  formatKlParts,
} from "@/lib/bookingMessages";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { getCollections } from "@/lib/db";
import { sendBookingRescheduledEmail } from "@/lib/email";
import { usesExclusiveTimeBlocking } from "@/lib/exclusiveBooking";
import {
  acquireExclusiveLocks,
  releaseExclusiveLocksAfterBookingRemoved,
} from "@/lib/exclusiveLocks";
import { sendBookingRescheduledPush } from "@/lib/pushNotifications";
import {
  sendAdminWhatsAppNotification,
  sendBookingRescheduledWhatsApp,
} from "@/lib/twilioWhatsApp";

const MIN_RESCHEDULE_NOTICE_HOURS = 6;
const rescheduleSchema = z.object({ slotId: z.string().min(1) });

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { clientId, response } = await requireClientReady(req);
    if (response || !clientId) return response;

    const { id } = await ctx.params;
    const bookingId = ObjectId.isValid(id) ? new ObjectId(id) : null;
    if (!bookingId) return jsonError("Invalid booking id", 400);

    const parsed = rescheduleSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }
    const targetSlotId = ObjectId.isValid(parsed.data.slotId)
      ? new ObjectId(parsed.data.slotId)
      : null;
    if (!targetSlotId) return jsonError("Invalid slot id", 400);

    const {
      bookings,
      timeSlots,
      items,
      settings,
      exclusiveLocks,
      clients,
    } = await getCollections();
    const now = new Date();
    const client = await clients.findOne({ _id: clientId });
    if (!client) return jsonError("Sign in required", 401);

    const booking = await bookings.findOne({ _id: bookingId });
    if (!booking) return jsonError("Booking not found", 404);
    const ownsBooking =
      booking.clientId?.equals(clientId) ||
      Boolean(
        client.email &&
          booking.email &&
          client.email.trim().toLowerCase() === booking.email.trim().toLowerCase(),
      );
    if (!ownsBooking) return jsonError("Booking not found", 404);
    if (booking.status !== "confirmed") {
      return jsonError("Only confirmed bookings can be rescheduled", 409);
    }
    if (booking.slotId?.equals(targetSlotId)) {
      return jsonError("Booking is already on this session", 409);
    }

    const tz = booking.businessTimeZone || BUSINESS_TIME_ZONE;
    const originalStart = DateTime.fromISO(booking.dateKey, { zone: tz })
      .startOf("day")
      .plus({ minutes: booking.startMin });
    const hoursUntilOriginal = originalStart.diff(
      DateTime.fromJSDate(now).setZone(tz),
      "hours",
    ).hours;
    if (hoursUntilOriginal < MIN_RESCHEDULE_NOTICE_HOURS) {
      return jsonError(
        `Rescheduling is allowed up to ${MIN_RESCHEDULE_NOTICE_HOURS} hours before the session.`,
        409,
      );
    }

    const targetSlot = await timeSlots.findOne({ _id: targetSlotId });
    if (!targetSlot) return jsonError("Slot not found", 404);
    if (targetSlot.cancelled) return jsonError("Slot is cancelled", 409);
    if (!booking.itemId.equals(targetSlot.itemId)) {
      return jsonError("Reschedule must keep the same class type", 409);
    }

    const item = await items.findOne({ _id: targetSlot.itemId });
    if (!item || !item.active) {
      return jsonError("Item not found or inactive", 409);
    }
    const rules = getBookingRulesFromSettings(
      await settings.findOne({ _id: "singleton" }),
    );
    if (
      !isSlotBookableByRules({
        now,
        dateKey: targetSlot.dateKey,
        startMin: targetSlot.startMin,
        rules,
      })
    ) {
      return jsonError("This slot is not bookable anymore", 409);
    }

    const exclusiveKey = (item.exclusiveKey ?? "").trim();
    const usesTargetExclusiveLock =
      Boolean(exclusiveKey) && usesExclusiveTimeBlocking(item.capacity);
    let targetReserved = false;
    let bookingMoved = false;
    let oldSlotDecremented = false;

    const releaseTargetReservation = async () => {
      if (!targetReserved) return;
      await timeSlots.updateOne(
        { _id: targetSlotId, bookedCount: { $gt: 0 } },
        { $inc: { bookedCount: -1 }, $set: { updatedAt: new Date() } },
      );
      targetReserved = false;
      if (usesTargetExclusiveLock) {
        await releaseExclusiveLocksAfterBookingRemoved({
          exclusiveLocks,
          bookings,
          exclusiveKey,
          dateKey: targetSlot.dateKey,
          itemId: item._id!,
          startMin: targetSlot.startMin,
          endMin: targetSlot.endMin,
        });
      }
    };

    if (usesTargetExclusiveLock) {
      const conflict = await bookings.findOne(
        {
          status: { $in: ["pending", "confirmed"] },
          exclusiveKey,
          dateKey: targetSlot.dateKey,
          itemId: { $ne: item._id },
          startMin: { $lt: targetSlot.endMin },
          endMin: { $gt: targetSlot.startMin },
        },
        { projection: { _id: 1 } },
      );
      if (conflict) return jsonError("This time is already booked", 409);

      const lockResult = await acquireExclusiveLocks({
        exclusiveLocks,
        exclusiveKey,
        dateKey: targetSlot.dateKey,
        itemId: item._id!,
        startMin: targetSlot.startMin,
        endMin: targetSlot.endMin,
        now,
      });
      if (!lockResult.ok) return jsonError("This time is already booked", 409);
    }

    let reservedSlot;
    try {
      reservedSlot = await timeSlots.findOneAndUpdate(
        {
          _id: targetSlotId,
          cancelled: false,
          itemId: item._id,
          $expr: { $lt: ["$bookedCount", item.capacity] },
        },
        { $inc: { bookedCount: 1 }, $set: { updatedAt: now } },
        { returnDocument: "after" },
      );
    } catch (reserveError) {
      if (usesTargetExclusiveLock) {
        await releaseExclusiveLocksAfterBookingRemoved({
          exclusiveLocks,
          bookings,
          exclusiveKey,
          dateKey: targetSlot.dateKey,
          itemId: item._id!,
          startMin: targetSlot.startMin,
          endMin: targetSlot.endMin,
        });
      }
      throw reserveError;
    }
    if (!reservedSlot) {
      if (usesTargetExclusiveLock) {
        await releaseExclusiveLocksAfterBookingRemoved({
          exclusiveLocks,
          bookings,
          exclusiveKey,
          dateKey: targetSlot.dateKey,
          itemId: item._id!,
          startMin: targetSlot.startMin,
          endMin: targetSlot.endMin,
        });
      }
      return jsonError("Slot is full or unavailable", 409);
    }
    targetReserved = true;

    const oldSlotId = booking.slotId ?? null;
    const oldExclusiveKey = (booking.exclusiveKey ?? "").trim();
    try {
      const moved = await bookings.updateOne(
        {
          _id: bookingId,
          status: "confirmed",
          ...(oldSlotId ? { slotId: oldSlotId } : { slotId: { $exists: false } }),
        },
        {
          $set: {
            slotId: reservedSlot._id,
            detached: false,
            itemId: item._id,
            exclusiveKey: exclusiveKey || undefined,
            dateKey: reservedSlot.dateKey,
            startMin: reservedSlot.startMin,
            endMin: reservedSlot.endMin,
            businessTimeZone: BUSINESS_TIME_ZONE,
            capacityAtBooking: item.capacity,
          },
          $unset: { detachedAt: "", detachedFromSlotId: "" },
        },
      );
      if (!moved.modifiedCount) {
        throw new Error("Booking changed while it was being rescheduled");
      }
      bookingMoved = true;

      if (oldSlotId) {
        const oldSlotUpdate = await timeSlots.updateOne(
          { _id: oldSlotId, bookedCount: { $gt: 0 } },
          { $inc: { bookedCount: -1 }, $set: { updatedAt: now } },
        );
        if (!oldSlotUpdate.modifiedCount) {
          throw new Error("Original slot capacity could not be released");
        }
        oldSlotDecremented = true;
      }

      if (oldExclusiveKey) {
        await releaseExclusiveLocksAfterBookingRemoved({
          exclusiveLocks,
          bookings,
          exclusiveKey: oldExclusiveKey,
          dateKey: booking.dateKey,
          itemId: booking.itemId,
          startMin: booking.startMin,
          endMin: booking.endMin,
        });
      }
    } catch (moveError) {
      if (!bookingMoved) {
        await releaseTargetReservation();
        throw moveError;
      }

      const restored = await bookings.updateOne(
        { _id: bookingId, status: "confirmed", slotId: targetSlotId },
        {
          $set: {
            ...(oldSlotId ? { slotId: oldSlotId } : {}),
            detached: booking.detached ?? false,
            itemId: booking.itemId,
            exclusiveKey: booking.exclusiveKey,
            dateKey: booking.dateKey,
            startMin: booking.startMin,
            endMin: booking.endMin,
            businessTimeZone: booking.businessTimeZone,
            capacityAtBooking: booking.capacityAtBooking,
          },
          ...(!oldSlotId ? { $unset: { slotId: "" } } : {}),
        },
      );
      if (!restored.modifiedCount) {
        throw new Error(
          `Reschedule failed and booking rollback could not be applied: ${
            moveError instanceof Error ? moveError.message : String(moveError)
          }`,
        );
      }
      if (oldSlotId && oldSlotDecremented) {
        await timeSlots.updateOne(
          { _id: oldSlotId },
          { $inc: { bookedCount: 1 }, $set: { updatedAt: new Date() } },
        );
      }
      await releaseTargetReservation();
      if (oldExclusiveKey && usesExclusiveTimeBlocking(booking.capacityAtBooking)) {
        await acquireExclusiveLocks({
          exclusiveLocks,
          exclusiveKey: oldExclusiveKey,
          dateKey: booking.dateKey,
          itemId: booking.itemId,
          startMin: booking.startMin,
          endMin: booking.endMin,
          now: new Date(),
        });
      }
      throw moveError;
    }

    const parts = formatKlParts({
      dateKey: reservedSlot.dateKey,
      startMin: reservedSlot.startMin,
      endMin: reservedSlot.endMin,
      tz,
    });
    await Promise.all([
      sendBookingRescheduledEmail({
        to: booking.email,
        name: booking.name,
        classTypeName: item.name,
        whatsapp: booking.whatsapp,
        bookingCode: booking.code,
        businessTimeZone: tz,
        previousDateKey: booking.dateKey,
        previousStartMin: booking.startMin,
        previousEndMin: booking.endMin,
        dateKey: reservedSlot.dateKey,
        startMin: reservedSlot.startMin,
        endMin: reservedSlot.endMin,
      }).catch(() => {}),
      sendBookingRescheduledWhatsApp({
        to: booking.whatsapp,
        dateKey: reservedSlot.dateKey,
        startMin: reservedSlot.startMin,
        endMin: reservedSlot.endMin,
        businessTimeZone: tz,
        body: buildCustomerRescheduledMessage({
          name: booking.name,
          classTypeName: item.name,
          bookingCode: booking.code,
          previousDateKey: booking.dateKey,
          previousStartMin: booking.startMin,
          previousEndMin: booking.endMin,
          dateKey: reservedSlot.dateKey,
          startMin: reservedSlot.startMin,
          endMin: reservedSlot.endMin,
          tz,
        }),
      }).catch(() => {}),
      sendAdminWhatsAppNotification({
        kind: "booking_rescheduled",
        name: booking.name,
        email: booking.email,
        whatsapp: booking.whatsapp,
        bookingCode: booking.code,
        classTypeName: item.name,
        dateKey: reservedSlot.dateKey,
        startMin: reservedSlot.startMin,
        endMin: reservedSlot.endMin,
        businessTimeZone: tz,
        extra: `Previous: ${booking.dateKey} ${booking.startMin}-${booking.endMin}`,
      }).catch(() => {}),
      sendBookingRescheduledPush({
        clientId: booking.clientId ?? clientId,
        className: item.name,
        bookingCode: booking.code,
        dateLabel: parts.dateLabel,
        timeLabel: parts.timeLabel,
      }).catch(() => {}),
    ]);

    return jsonOk({
      rescheduled: true,
      bookingId: bookingId.toHexString(),
      slotId: reservedSlot._id.toHexString(),
      itemId: item._id!.toHexString(),
      dateKey: reservedSlot.dateKey,
      startMin: reservedSlot.startMin,
      endMin: reservedSlot.endMin,
    });
  } catch (error) {
    return jsonError(
      "Server error",
      500,
      error instanceof Error ? error.message : error,
    );
  }
}
