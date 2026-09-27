export const PENDING_BOOKING_CODES_STORAGE_KEY =
  "fasea.pending-booking-codes.v1";

const BOOKING_CODE_RE = /^\d{6}$/;
const MAX_STORED_CODES = 10;

export function readPendingBookingCodes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(
      window.localStorage.getItem(PENDING_BOOKING_CODES_STORAGE_KEY) ?? "[]",
    );
    if (!Array.isArray(raw)) return [];
    return [
      ...new Set(
        raw
          .map((value) => String(value).trim())
          .filter((value) => BOOKING_CODE_RE.test(value)),
      ),
    ].slice(-MAX_STORED_CODES);
  } catch {
    return [];
  }
}

export function writePendingBookingCodes(codes: string[]): void {
  if (typeof window === "undefined") return;
  const valid = [
    ...new Set(codes.map((code) => code.trim()).filter((code) => BOOKING_CODE_RE.test(code))),
  ].slice(-MAX_STORED_CODES);
  window.localStorage.setItem(
    PENDING_BOOKING_CODES_STORAGE_KEY,
    JSON.stringify(valid),
  );
}

export function rememberPendingBookingCode(code: string): void {
  if (!BOOKING_CODE_RE.test(code)) return;
  writePendingBookingCodes([...readPendingBookingCodes(), code]);
}

export function forgetPendingBookingCode(code: string): void {
  writePendingBookingCodes(
    readPendingBookingCodes().filter((stored) => stored !== code),
  );
}
