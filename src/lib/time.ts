import { DateTime } from "luxon";

export type DateKey = `${number}-${number}-${number}`; // YYYY-MM-DD

export function isValidDateKey(dateKey: string): dateKey is DateKey {
  const dt = DateTime.fromISO(dateKey, { zone: "utc" });
  return dt.isValid && dt.toISODate() === dateKey;
}

export function getDateKeyFromJsDate(date: Date, timeZone: string): DateKey {
  const dt = DateTime.fromJSDate(date, { zone: "utc" }).setZone(timeZone);
  const iso = dt.toISODate();
  if (!iso) throw new Error("Failed to compute dateKey");
  return iso as DateKey;
}

export function dateKeyStartInZone(dateKey: DateKey, timeZone: string): DateTime {
  const dt = DateTime.fromISO(dateKey, { zone: timeZone }).startOf("day");
  if (!dt.isValid) throw new Error(`Invalid dateKey/timeZone: ${dateKey} ${timeZone}`);
  return dt;
}

export function minutesToUtcIso(
  dateKey: DateKey,
  minutesFromMidnight: number,
  timeZone: string
): string {
  const dt = dateKeyStartInZone(dateKey, timeZone).plus({
    minutes: minutesFromMidnight,
  });
  return dt.toUTC().toISO({ suppressMilliseconds: true }) ?? dt.toUTC().toISO()!;
}

export function clampMinuteOfDay(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(24 * 60, Math.floor(n)));
}

