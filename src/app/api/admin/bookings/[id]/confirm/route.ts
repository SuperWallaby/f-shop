import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../../../_utils/http";
import { requireAdmin } from "../../../../_utils/adminAuth";
import { sendBookingCreatedEmail } from "@/lib/email";
import {
  sendAdminWhatsAppNotification,
  sendBookingConfirmedWhatsApp,
} from "@/lib/twilioWhatsApp";
import { sendBookingConfirmedPush } from "@/lib/pushNotifications";
import { formatKlParts } from "@/lib/bookingMessages";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const { id } = await ctx.params;
    const bookingId = ObjectId.isValid(id) ? new ObjectId(id) : null;
    if (!bookingId) return jsonError("Invalid booking id", 400);

    const { bookings, items } = await getCollections();
    const booking = await bookings.findOne({ _id: bookingId });
    if (!booking) return jsonError("Booking not found", 404);
    if (booking.status === "confirmed") {
      return jsonOk({ confirmed: true, status: "confirmed" });
    }
    if (booking.status !== "pending") {
      return jsonError("Only pending bookings can be confirmed", 409);
    }

    const now = new Date();
    const updated = await bookings.updateOne(
      { _id: bookingId, status: "pending" },
      { $set: { status: "confirmed", confirmedAt: now } },
    );
    if (!updated.modifiedCount) {
      return jsonError("Booking status changed. Refresh and try again.", 409);
    }

    const item = await items.findOne(
      { _id: booking.itemId },
      { projection: { name: 1 } },
    );
    const classTypeName = item?.name ?? "Pilates";
    const tz = booking.businessTimeZone || BUSINESS_TIME_ZONE;
    const parts = formatKlParts({
      dateKey: booking.dateKey,
      startMin: booking.startMin,
      endMin: booking.endMin,
      tz,
    });

    await Promise.all([
      sendBookingCreatedEmail({
        to: booking.email,
        name: booking.name,
        classTypeName,
        whatsapp: booking.whatsapp ?? "",
        bookingCode: booking.code,
        dateKey: booking.dateKey,
        startMin: booking.startMin,
        endMin: booking.endMin,
        businessTimeZone: tz,
      }).catch(() => {}),
      sendBookingConfirmedWhatsApp({
        to: booking.whatsapp,
        name: booking.name,
        classTypeName,
        bookingCode: booking.code,
        dateKey: booking.dateKey,
        startMin: booking.startMin,
        endMin: booking.endMin,
        businessTimeZone: tz,
      }).catch(() => {}),
      sendAdminWhatsAppNotification({
        kind: "booking_confirmed",
        name: booking.name,
        email: booking.email,
        whatsapp: booking.whatsapp,
        bookingCode: booking.code,
        classTypeName,
        dateKey: booking.dateKey,
        startMin: booking.startMin,
        endMin: booking.endMin,
        businessTimeZone: tz,
        extra: "Confirmed by admin after WhatsApp conversation",
      }).catch(() => {}),
      sendBookingConfirmedPush({
        clientId: booking.clientId,
        className: classTypeName,
        bookingCode: booking.code ?? "",
        dateLabel: parts.dateLabel,
        timeLabel: parts.timeLabel,
      }).catch(() => {}),
    ]);

    return jsonOk({ confirmed: true, status: "confirmed" });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
