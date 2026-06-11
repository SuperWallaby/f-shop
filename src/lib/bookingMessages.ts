import { DateTime } from "luxon";

export function formatKlParts(args: {
  dateKey: string;
  startMin: number;
  endMin: number;
  tz: string;
}): { dateLabel: string; timeLabel: string; timeRangeLabel: string } {
  const base = DateTime.fromISO(args.dateKey, { zone: args.tz }).startOf("day");
  const start = base.plus({ minutes: args.startMin });
  const end = base.plus({ minutes: args.endMin });
  return {
    dateLabel: start.toFormat("yyyy-LL-dd (ccc)"),
    timeLabel: start.toFormat("h:mm a"),
    timeRangeLabel: `${start.toFormat("h:mm a")}–${end.toFormat("h:mm a")}`,
  };
}

export function buildCustomerBookingConfirmationMessage(args: {
  name: string;
  classTypeName: string;
  bookingCode?: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  tz: string;
}): string {
  const { dateLabel, timeLabel } = formatKlParts(args);
  return (
    `Hi ${args.name} 🤍\n` +
    `Your Pilates class booking is confirmed.\n\n` +
    `Class Type: ${args.classTypeName}\n` +
    `🗓 Date: ${dateLabel}\n` +
    `⏰ Time: ${timeLabel}\n` +
    (args.bookingCode ? `Booking Code: ${args.bookingCode}\n` : ``) +
    `\n` +
    `Please bring grip socks, wear comfortable attire, and bring a water bottle.\n` +
    `Kindly arrive 10–15 minutes earlier before class.\n\n` +
    `✨ Cancellation & No-Show Policy:\n` +
    `• Free cancellation or reschedule at least 12 hours before class\n` +
    `• Group class: RM10 (late cancellation / no-show)\n` +
    `• Private session: RM20 (late cancellation / no-show)\n` +
    `• Fee applies when the slot remains unused\n\n` +
    `Thank you for your understanding 🤍 Looking forward to seeing you ✨`
  );
}

export function buildCustomerReminderMessage(args: {
  dateKey: string;
  startMin: number;
  endMin: number;
  tz: string;
}): string {
  const { dateLabel, timeLabel } = formatKlParts(args);
  return (
    `Hi Pilates Girls 🤍\n` +
    `This is a gentle reminder that you have class tomorrow (${dateLabel}) at ${timeLabel}.\n\n` +
    `Please arrive 15 minutes earlier to prepare before class starts.\n` +
    `See you soon 🤍`
  );
}

export function buildCustomerCancelledByInstructorMessage(args: {
  classTypeName: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  tz: string;
}): string {
  const { dateLabel, timeLabel } = formatKlParts(args);
  return (
    `Dear Pilates Girls 💖\n` +
    `We regret to inform you that today’s Pilates class on ${dateLabel} at ${timeLabel} has been cancelled due to unforeseen circumstances.\n\n` +
    `Class Type: ${args.classTypeName}\n\n` +
    `We sincerely apologise for the inconvenience.\n` +
    `Your session can be rescheduled. Please reach us soon :)\n\n` +
    `Thank you for your understanding 🤍`
  );
}

export function buildCustomerRescheduledMessage(args: {
  name: string;
  classTypeName: string;
  bookingCode?: string;
  previousDateKey: string;
  previousStartMin: number;
  previousEndMin: number;
  dateKey: string;
  startMin: number;
  endMin: number;
  tz: string;
}): string {
  const prev = formatKlParts({
    dateKey: args.previousDateKey,
    startMin: args.previousStartMin,
    endMin: args.previousEndMin,
    tz: args.tz,
  });
  const next = formatKlParts({
    dateKey: args.dateKey,
    startMin: args.startMin,
    endMin: args.endMin,
    tz: args.tz,
  });
  return (
    `Hi ${args.name} 🤍\n` +
    `Your Pilates class booking has been rescheduled.\n\n` +
    `Class Type: ${args.classTypeName}\n` +
    `Previous: ${prev.dateLabel} at ${prev.timeRangeLabel}\n` +
    `New: ${next.dateLabel} at ${next.timeRangeLabel}\n` +
    (args.bookingCode ? `Booking Code: ${args.bookingCode}\n` : ``) +
    `\n` +
    `Please bring grip socks, wear comfortable attire, and bring a water bottle.\n` +
    `Kindly arrive 10–15 minutes earlier before class.\n\n` +
    `If this change was not expected, please reply to this email or contact us on WhatsApp.\n\n` +
    `Looking forward to seeing you ✨`
  );
}

export function buildCustomerCancelledByClientMessage(args: {
  name: string;
  classTypeName: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  tz: string;
}): string {
  const { dateLabel, timeLabel } = formatKlParts(args);
  return (
    `Hi ${args.name} ✨\n` +
    `Your booking for ${args.classTypeName} on ${dateLabel} at ${timeLabel} has been successfully cancelled as requested.\n\n` +
    `If you’d like to rebook, feel free to let us know 🤍`
  );
}

export function buildCustomerNoShowMessage(args: {
  name: string;
  firstTimer: boolean;
}): string {
  if (args.firstTimer) {
    return (
      `Hi ${args.name} 🤍\n` +
      `For first-time clients, we understand unexpected situations.\n\n` +
      `A one-time grace may be given for late cancellation or no-show.\n` +
      `Kindly inform us as early as possible for future bookings ✨`
    );
  }
  return (
    `Hi ${args.name} 🤍\n` +
    `We noticed you were unable to attend your scheduled class today.\n\n` +
    `As per studio policy, a no-show fee applies:\n` +
    `• Group class: RM10\n` +
    `• Private session: RM20\n\n` +
    `This helps us manage class slots fairly.\n` +
    `Thank you for your kind understanding ✨`
  );
}

export function buildAdminBookingMessage(args: {
  kind:
    | "booking_confirmed"
    | "booking_cancelled_by_client"
    | "booking_rescheduled"
    | "class_cancelled_by_instructor"
    | "reminder_sent"
    | "no_show_marked";
  name?: string;
  email?: string;
  whatsapp?: string;
  bookingCode?: string;
  classTypeName?: string;
  dateKey?: string;
  startMin?: number;
  endMin?: number;
  tz?: string;
  extra?: string;
}): string {
  const header =
    args.kind === "booking_confirmed"
      ? "New booking"
      : args.kind === "booking_cancelled_by_client"
        ? "Booking cancelled (client)"
        : args.kind === "booking_rescheduled"
          ? "Booking rescheduled"
          : args.kind === "class_cancelled_by_instructor"
          ? "Class cancelled (instructor)"
          : args.kind === "reminder_sent"
            ? "Reminder job"
            : "No-show marked";

  const lines: string[] = [header];
  if (args.bookingCode) lines.push(`Code: ${args.bookingCode}`);
  if (args.classTypeName) lines.push(`Class: ${args.classTypeName}`);
  if (args.dateKey && args.startMin !== undefined && args.endMin !== undefined && args.tz) {
    const { dateLabel, timeRangeLabel } = formatKlParts({
      dateKey: args.dateKey,
      startMin: args.startMin,
      endMin: args.endMin,
      tz: args.tz,
    });
    lines.push(`When: ${dateLabel} ${timeRangeLabel}`);
  }
  if (args.name) lines.push(`Name: ${args.name}`);
  if (args.email) lines.push(`Email: ${args.email}`);
  if (args.whatsapp) lines.push(`WhatsApp: ${args.whatsapp}`);
  if (args.extra) lines.push(args.extra);
  return lines.join("\n");
}

