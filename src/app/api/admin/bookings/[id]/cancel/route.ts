import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../../../_utils/http";
import { requireAdmin } from "../../../../_utils/adminAuth";
import { sendBookingCancelledEmail } from "@/lib/email";
import { releaseExclusiveLocksAfterBookingRemoved } from "@/lib/exclusiveLocks";
import { insertBookingCancelRefund } from "@/lib/credits";
import {
  sendAdminWhatsAppNotification,
  sendBookingCancelledByClientWhatsApp,
} from "@/lib/twilioWhatsApp";
import { sendBookingCancelledPush } from "@/lib/pushNotifications";
import { formatKlParts } from "@/lib/bookingMessages";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(_req);
  if (auth) return auth;

  try {
    const { id } = await ctx.params;
    const bookingObjectId = ObjectId.isValid(id) ? new ObjectId(id) : null;
    if (!bookingObjectId) return jsonError("Invalid booking id", 400);

    const { bookings, timeSlots, exclusiveLocks, items, creditLedger } =
      await getCollections();
    const now = new Date();

    const booking = await bookings.findOne({ _id: bookingObjectId });
    if (!booking) return jsonError("Booking not found", 404);

    const item = await items.findOne({ _id: booking.itemId });
    const classTypeName = item?.name ?? "Pilates";

    if (booking.status === "cancelled") {
      return jsonOk({ cancelled: true });
    }

    const updated = await bookings.updateOne(
      { _id: bookingObjectId, status: { $in: ["pending", "confirmed"] } },
      { $set: { status: "cancelled", cancelledAt: now } }
    );

    if (updated.modifiedCount) {
      if (booking.slotId) {
        await timeSlots.updateOne(
          { _id: booking.slotId, bookedCount: { $gt: 0 } },
          { $inc: { bookedCount: -1 }, $set: { updatedAt: now } }
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

      const clientOid = booking.clientId;
      if (clientOid && booking._id) {
        try {
          await insertBookingCancelRefund({
            creditLedger,
            clientId: clientOid,
            bookingId: booking._id,
            now,
            note: "Credit restored after admin cancellation",
          });
        } catch {
          // best-effort; booking is already cancelled
        }
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
          businessTimeZone: booking.businessTimeZone || "UTC",
        });
      } catch {
        // ignore
      }

      // WhatsApp + push (best-effort)
      const cancelTz = booking.businessTimeZone || BUSINESS_TIME_ZONE;
      const cancelParts = formatKlParts({
        dateKey: booking.dateKey,
        startMin: booking.startMin,
        endMin: booking.endMin,
        tz: cancelTz,
      });
      await Promise.all([
        sendBookingCancelledByClientWhatsApp({
          to: booking.whatsapp,
          name: booking.name,
          classTypeName,
          dateKey: booking.dateKey,
          startMin: booking.startMin,
          endMin: booking.endMin,
          businessTimeZone: cancelTz,
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
          businessTimeZone: cancelTz,
        }).catch(() => {}),
        sendBookingCancelledPush({
          clientId: booking.clientId,
          className: classTypeName,
          bookingCode: booking.code ?? undefined,
          dateLabel: cancelParts.dateLabel,
          timeLabel: cancelParts.timeLabel,
        }).catch(() => {}),
      ]);
    }

    return jsonOk({ cancelled: true });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
