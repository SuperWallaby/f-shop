import { Resend } from "resend";
import { DateTime } from "luxon";
import { requireEnv } from "./env";
import {
  buildAdminBookingMessage,
  buildCustomerBookingConfirmationMessage,
  buildCustomerCancelledByClientMessage,
  buildCustomerCancelledByInstructorMessage,
  buildCustomerNoShowMessage,
  buildCustomerReminderMessage,
} from "./bookingMessages";

const STUDIO_NOTIFY_EMAIL = "faseabooking@gmail.com";

function getResend(): Resend {
  const key = requireEnv("RESEND_API_KEY");
  return new Resend(key);
}

function getFrom(): string {
  return requireEnv("EMAIL_FROM");
}

function formatSlot(
  dateKey: string,
  startMin: number,
  endMin: number,
  timeZone: string
): string {
  const base = DateTime.fromISO(dateKey, { zone: timeZone }).startOf("day");
  const start = base.plus({ minutes: startMin });
  const end = base.plus({ minutes: endMin });
  const dateLabel = start.toFormat("yyyy-LL-dd (ccc)");
  const timeLabel = `${start.toFormat("h:mm a")}–${end.toFormat("h:mm a")}`;
  return `${dateLabel} ${timeLabel} (${timeZone})`;
}

export async function sendBookingCreatedEmail(args: {
  to: string; // customer email
  name: string;
  classTypeName: string;
  whatsapp?: string;
  bookingCode?: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  businessTimeZone: string;
}) {
  const resend = getResend();
  const from = getFrom();
  const when = formatSlot(
    args.dateKey,
    args.startMin,
    args.endMin,
    args.businessTimeZone
  );

  // Customer email
  await resend.emails.send({
    from,
    to: args.to,
    subject: "Booking confirmed",
    text: buildCustomerBookingConfirmationMessage({
      name: args.name,
      classTypeName: args.classTypeName,
      bookingCode: args.bookingCode,
      dateKey: args.dateKey,
      startMin: args.startMin,
      endMin: args.endMin,
      tz: args.businessTimeZone,
    }),
  });

  // Studio notification
  await resend.emails.send({
    from,
    to: STUDIO_NOTIFY_EMAIL,
    subject: "New booking",
    text: buildAdminBookingMessage({
      kind: "booking_confirmed",
      name: args.name,
      email: args.to,
      whatsapp: args.whatsapp ?? "",
      bookingCode: args.bookingCode,
      classTypeName: args.classTypeName,
      dateKey: args.dateKey,
      startMin: args.startMin,
      endMin: args.endMin,
      tz: args.businessTimeZone,
      extra: `When: ${when}`,
    }),
  });
}

export async function sendBookingCancelledEmail(args: {
  to: string; // customer email
  name: string;
  classTypeName: string;
  whatsapp?: string;
  bookingCode?: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  businessTimeZone: string;
}) {
  const resend = getResend();
  const from = getFrom();
  const when = formatSlot(
    args.dateKey,
    args.startMin,
    args.endMin,
    args.businessTimeZone
  );

  // Customer email
  await resend.emails.send({
    from,
    to: args.to,
    subject: "Booking cancelled",
    text: buildCustomerCancelledByClientMessage({
      name: args.name,
      classTypeName: args.classTypeName,
      dateKey: args.dateKey,
      startMin: args.startMin,
      endMin: args.endMin,
      tz: args.businessTimeZone,
    }),
  });

  // Studio notification
  await resend.emails.send({
    from,
    to: STUDIO_NOTIFY_EMAIL,
    subject: "Booking cancelled",
    text: buildAdminBookingMessage({
      kind: "booking_cancelled_by_client",
      name: args.name,
      email: args.to,
      whatsapp: args.whatsapp ?? "",
      bookingCode: args.bookingCode,
      classTypeName: args.classTypeName,
      dateKey: args.dateKey,
      startMin: args.startMin,
      endMin: args.endMin,
      tz: args.businessTimeZone,
      extra: `When: ${when}`,
    }),
  });
}

export async function sendClassCancelledByInstructorEmail(args: {
  to: string; // customer email
  classTypeName: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  businessTimeZone: string;
}) {
  const resend = getResend();
  const from = getFrom();

  await resend.emails.send({
    from,
    to: args.to,
    subject: "Class cancelled",
    text: buildCustomerCancelledByInstructorMessage({
      classTypeName: args.classTypeName,
      dateKey: args.dateKey,
      startMin: args.startMin,
      endMin: args.endMin,
      tz: args.businessTimeZone,
    }),
  });
}

export async function sendBookingReminderEmail(args: {
  to: string; // customer email
  dateKey: string;
  startMin: number;
  endMin: number;
  businessTimeZone: string;
}) {
  const resend = getResend();
  const from = getFrom();

  await resend.emails.send({
    from,
    to: args.to,
    subject: "Class reminder",
    text: buildCustomerReminderMessage({
      dateKey: args.dateKey,
      startMin: args.startMin,
      endMin: args.endMin,
      tz: args.businessTimeZone,
    }),
  });
}

export async function sendNoShowEmail(args: {
  to: string; // customer email
  name: string;
  firstTimer: boolean;
}) {
  const resend = getResend();
  const from = getFrom();

  await resend.emails.send({
    from,
    to: args.to,
    subject: "No-show notice",
    text: buildCustomerNoShowMessage({
      name: args.name,
      firstTimer: args.firstTimer,
    }),
  });
}

