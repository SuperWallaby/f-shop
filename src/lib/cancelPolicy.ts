import { DateTime } from "luxon";

/** Self-serve cancel closes this many hours before class start. */
export const CANCEL_NOTICE_HOURS = 10;

/** Shown in the cancel policy. Bookings close this many hours before class. */
export const BOOKING_NOTICE_HOURS = 10;

/** Late cancel / no-show fees published on the booking page. */
export const GROUP_LATE_CANCEL_FEE_RM = 10;
export const PRIVATE_LATE_CANCEL_FEE_RM = 20;

export const STUDIO_WHATSAPP_DIGITS = "60145403560";

export function isPrivateClass(className: string): boolean {
  return /private/i.test(className);
}

export function lateCancelFeeRm(className: string): number {
  return isPrivateClass(className)
    ? PRIVATE_LATE_CANCEL_FEE_RM
    : GROUP_LATE_CANCEL_FEE_RM;
}

export function hoursUntilClass(startUtc: string, now = DateTime.utc()): number {
  const start = DateTime.fromISO(startUtc, { zone: "utc" });
  if (!start.isValid) return Number.NEGATIVE_INFINITY;
  return start.diff(now, "hours").hours;
}

export function canSelfCancel(startUtc: string, now = DateTime.utc()): boolean {
  return hoursUntilClass(startUtc, now) >= CANCEL_NOTICE_HOURS;
}

export function cancelPolicyText(className: string): string {
  const fee = lateCancelFeeRm(className);
  const kind = isPrivateClass(className) ? "private session" : "group class";
  return [
    `Bookings can be made until ${BOOKING_NOTICE_HOURS} hours before class.`,
    `You can cancel here until ${CANCEL_NOTICE_HOURS} hours before class.`,
    `Inside ${CANCEL_NOTICE_HOURS} hours, message us on WhatsApp and pay the late cancellation fee: RM ${fee} for this ${kind}.`,
    `Group class RM ${GROUP_LATE_CANCEL_FEE_RM}. Private session RM ${PRIVATE_LATE_CANCEL_FEE_RM}.`,
  ].join(" ");
}

export function lateCancelWhatsAppUrl(args: {
  code: string;
  className: string;
  when: string;
}): string {
  const fee = lateCancelFeeRm(args.className);
  const text = [
    "Late cancellation",
    `Class: ${args.className}`,
    `When: ${args.when}`,
    `Booking Code: ${args.code}`,
    `I am inside ${CANCEL_NOTICE_HOURS} hours of class and will pay the RM ${fee} cancellation fee.`,
  ].join("\n");
  return `https://wa.me/${STUDIO_WHATSAPP_DIGITS}?text=${encodeURIComponent(text)}`;
}
