import type { BookingDb } from "@/lib/db";
import { sendBookingCreatedEmail } from "@/lib/email";
import {
  sendAdminWhatsAppNotification,
  sendBookingConfirmedWhatsApp,
} from "@/lib/twilioWhatsApp";
import { sendBookingConfirmedPush } from "@/lib/pushNotifications";
import { formatKlParts } from "@/lib/bookingMessages";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";

/** Email + WhatsApp + push to the client and a WhatsApp note to the studio (best-effort). */
export async function notifyBookingConfirmed(args: {
  booking: BookingDb;
  classTypeName: string;
  adminNote: string;
}): Promise<void> {
  const { booking, classTypeName } = args;
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
      extra: args.adminNote,
    }).catch(() => {}),
    sendBookingConfirmedPush({
      clientId: booking.clientId,
      className: classTypeName,
      bookingCode: booking.code ?? "",
      dateLabel: parts.dateLabel,
      timeLabel: parts.timeLabel,
    }).catch(() => {}),
  ]);
}
