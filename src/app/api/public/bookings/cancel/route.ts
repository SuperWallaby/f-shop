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
import { getClientIdFromRequest } from "@/app/api/_utils/clientAuth";
import { insertBookingCancelRefund } from "@/lib/credits";

const MIN_CANCEL_NOTICE_HOURS = 6;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = publicCancelBookingSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid body", 400, parsed.error.flatten());

    const { code, email, whatsapp } = parsed.data;
    const sessionClientId = getClientIdFromRequest(req);
    const { bookings, timeSlots, exclusiveLocks, items, creditLedger, clients } =
      await getCollections();
    const now = new Date();

    const booking = await bookings.findOne({ code });
    if (!booking) return jsonError("Booking not found", 404);
    if (booking.status === "cancelled") return jsonOk({ cancelled: true });

    let authorized = false;
    if (sessionClientId) {
      if (booking.clientId?.equals(sessionClientId)) {
        authorized = true;
      } else {
        const sessionClient = await clients.findOne({ _id: sessionClientId });
        const sessionEmail = (sessionClient?.email ?? "").trim().toLowerCase();
        if (
          sessionEmail &&
          sessionEmail === (booking.email ?? "").trim().toLowerCase()
        ) {
          authorized = true;
        }
      }
    }
    if (!authorized && email) {
      const re = new RegExp(
        `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i",
      );
      if (re.test(booking.email ?? "")) authorized = true;
    }
    if (!authorized && whatsapp) {
      const normalize = (v: string) => v.replace(/\D/g, "");
      if (
        normalize(whatsapp) &&
        normalize(whatsapp) === normalize(booking.whatsapp ?? "")
      ) {
        authorized = true;
      }
    }
    if (!authorized) {
      return jsonError(
        "Provide the email or WhatsApp used for this booking, or sign in to cancel.",
        403,
      );
    }

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
        409,
      );
    }

    const updated = await bookings.updateOne(
      { _id: booking._id, status: "confirmed" },
      { $set: { status: "cancelled", cancelledAt: new Date() } },
    );

    if (updated.modifiedCount) {
      if (booking.slotId) {
        await timeSlots.updateOne(
          { _id: booking.slotId, bookedCount: { $gt: 0 } },
          { $inc: { bookedCount: -1 }, $set: { updatedAt: new Date() } },
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

      const clientOid = booking.clientId;
      if (clientOid && booking._id) {
        try {
          await insertBookingCancelRefund({
            creditLedger,
            clientId: clientOid,
            bookingId: booking._id,
            now,
            note: "Credit restored after client cancellation",
          });
        } catch {
          // best-effort; booking is already cancelled
        }
      }
    }

    return jsonOk({ cancelled: true });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
