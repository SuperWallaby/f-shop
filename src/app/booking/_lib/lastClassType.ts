const STORAGE_KEY = "fasea.booking.lastClassType.v1";

export function readLastClassTypeId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw?.trim()) return null;
    return raw.trim();
  } catch {
    return null;
  }
}

export function writeLastClassTypeId(itemId: string): void {
  if (typeof window === "undefined") return;
  const trimmed = itemId.trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    // ignore quota / private mode
  }
}
