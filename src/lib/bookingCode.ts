export function generateBookingCode6(): string {
  // 6-digit numeric string, allowing leading zeros.
  const n = Math.floor(Math.random() * 1_000_000);
  return String(n).padStart(6, "0");
}

