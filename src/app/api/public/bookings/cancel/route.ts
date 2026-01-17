import { NextRequest } from "next/server";
import { DateTime } from "luxon";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../../_utils/http";
import { publicCancelBookingSchema } from "@/lib/schemas";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { sendBookingCancelledEmail } from "@/lib/email";
import { releaseExclusiveLocksAfterBookingRemoved } from "@/lib/exclusiveLocks";
import {
  sendAdminWhatsAppNotification,
  sendBookingCancelledByClientWhatsApp,
} from "@/lib/twilioWhatsApp";

const MIN_CANCEL_NOTICE_HOURS = 6;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = publicCancelBookingSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid body", 400, parsed.error.flatten());

    const { code, email, whatsapp } = parsed.data;
    const { bookings, timeSlots, exclusiveLocks, items } = await getCollections();
    const now = new Date();

    const booking = await bookings.findOne({
      code,
      ...(email ? { email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } : {}),
      ...(whatsapp ? { whatsapp } : {}),
    });

    if (!booking) return jsonError("Booking not found", 404);
    if (booking.status === "cancelled") return jsonOk({ cancelled: true });

    const item = await items.findOne({ _id: booking.itemId });
    const classTypeName = item?.name ?? "Pilates";

    const tz = booking.businessTimeZone || BUSINESS_TIME_ZONE;
    const start = DateTime.fromISO(booking.dateKey, { zone: tz })
      .startOf("day")
      .plus({ minutes: booking.startMin });
    const hoursUntil = start.diff(DateTime.fromJSDate(now).setZone(tz), "hours").hours;

    if (!(hoursUntil >= MIN_CANCEL_NOTICE_HOURS)) {
      return jsonError(
        `Cancellation is allowed up to ${MIN_CANCEL_NOTICE_HOURS} hours before the session.`,
        409
      );
    }

    const updated = await bookings.updateOne(
      { _id: booking._id, status: "confirmed" },
      { $set: { status: "cancelled", cancelledAt: new Date() } }
    );

    if (updated.modifiedCount) {
      if (booking.slotId) {
        await timeSlots.updateOne(
          { _id: booking.slotId, bookedCount: { $gt: 0 } },
          { $inc: { bookedCount: -1 }, $set: { updatedAt: new Date() } }
        );
      }

      const exKey = (booking.exclusiveKey ?? "").trim();
      if (exKey) {
        await releaseExclusiveLocksAfterBookingRemoved({
          exclusiveLocks,
          bookings,
          exclusiveKey: exKey,
          dateKey: booking.dateKey,
          itemId: booking.itemId,
          startMin: booking.startMin,
          endMin: booking.endMin,
        });
      }

      try {
        await sendBookingCancelledEmail({
          to: booking.email,
          name: booking.name,
          classTypeName,
          whatsapp: booking.whatsapp ?? "",
          bookingCode: booking.code ?? undefined,
          dateKey: booking.dateKey,
          startMin: booking.startMin,
          endMin: booking.endMin,
          businessTimeZone: tz,
        });
      } catch {
        // ignore
      }

      // WhatsApp (best-effort)
      await Promise.all([
        sendBookingCancelledByClientWhatsApp({
          to: booking.whatsapp,
          name: booking.name,
          classTypeName,
          dateKey: booking.dateKey,
          startMin: booking.startMin,
          endMin: booking.endMin,
          businessTimeZone: tz,
        }).catch(() => {}),
        sendAdminWhatsAppNotification({
          kind: "booking_cancelled_by_client",
          name: booking.name,
          email: booking.email,
          whatsapp: booking.whatsapp,
          bookingCode: booking.code ?? undefined,
          classTypeName,
          dateKey: booking.dateKey,
          startMin: booking.startMin,
          endMin: booking.endMin,
          businessTimeZone: tz,
        }).catch(() => {}),
      ]);
    }

    return jsonOk({ cancelled: true });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

