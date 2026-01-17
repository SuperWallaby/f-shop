import { DateTime } from "luxon";
import { BUSINESS_TIME_ZONE } from "./constants";
import type { SettingsDoc } from "./db";

export type BookingRules = {
  minNoticeHours: number;
  maxDaysAhead: number;
};

export const DEFAULT_BOOKING_RULES: BookingRules = {
  minNoticeHours: 0,
  maxDaysAhead: 90,
};

export function getBookingRulesFromSettings(settings?: SettingsDoc | null): BookingRules {
  const r = settings?.bookingRules;
  if (!r) return DEFAULT_BOOKING_RULES;
  return {
    minNoticeHours: Number.isFinite(r.minNoticeHours) ? Math.max(0, r.minNoticeHours) : 0,
    maxDaysAhead: Number.isFinite(r.maxDaysAhead) ? Math.max(1, r.maxDaysAhead) : 90,
  };
}

export function computeBookingWindowNow(now: Date, rules: BookingRules) {
  const nowTz = DateTime.fromJSDate(now).setZone(BUSINESS_TIME_ZONE);
  const earliest = nowTz.plus({ hours: rules.minNoticeHours });
  const latestDateKey = nowTz.plus({ days: rules.maxDaysAhead }).toISODate()!;
  return { nowTz, earliest, latestDateKey };
}

export function isSlotBookableByRules(args: {
  now: Date;
  dateKey: string;
  startMin: number;
  rules: BookingRules;
}): boolean {
  const { earliest, latestDateKey } = computeBookingWindowNow(args.now, args.rules);
  if (args.dateKey > latestDateKey) return false;
  const slotStart = DateTime.fromISO(args.dateKey, { zone: BUSINESS_TIME_ZONE })
    .startOf("day")
    .plus({ minutes: args.startMin });
  return slotStart >= earliest;
}

