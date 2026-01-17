import { DateTime } from "luxon";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";

export function dateToDateKeyBusiness(date: Date): string {
  const iso = DateTime.fromJSDate(date).setZone(BUSINESS_TIME_ZONE).toISODate();
  return iso ?? DateTime.fromJSDate(date).toISODate() ?? "";
}

export function hhmmToMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

export function minutesToHhmm(min: number): string {
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function hhmmToAmPmLabel(hhmm: string): string | null {
  const min = hhmmToMinutes(hhmm);
  if (min === null) return null;
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatLocalTimeRange(startUtc: string, endUtc: string): string {
  const start = DateTime.fromISO(startUtc, { zone: "utc" }).toLocal();
  const end = DateTime.fromISO(endUtc, { zone: "utc" }).toLocal();
  return `${start.toFormat("h:mm a")} – ${end.toFormat("h:mm a")}`;
}

export function minutesToAmPm(min: number): string {
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

export function minutesToAmPmRange(startMin: number, endMin: number): string {
  return `${minutesToAmPm(startMin)}–${minutesToAmPm(endMin)}`;
}

