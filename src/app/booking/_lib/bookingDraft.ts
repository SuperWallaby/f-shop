const STORAGE_KEY = "fasea.booking.draft.v1";

export type BookingDraft = {
  itemId?: string;
  dateKey?: string;
  slotId?: string;
  /** `yyyy-MM` — calendar month when the date was picked */
  monthKey?: string;
  name?: string;
  email?: string;
  whatsapp?: string;
  consentWhatsapp?: boolean;
  marketingOptIn?: boolean;
  /** @deprecated legacy guest field */
  whatsappOverride?: string;
};

export function readBookingDraft(): BookingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BookingDraft;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeBookingDraft(draft: BookingDraft): void {
  if (typeof window === "undefined") return;
  try {
    const cleaned = Object.fromEntries(
      Object.entries(draft).filter(([, v]) => v !== undefined && v !== ""),
    ) as BookingDraft;
    if (Object.keys(cleaned).length === 0) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // ignore quota / private mode
  }
}

export function clearBookingDraft(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function buildBookingDraft(args: {
  itemId: string;
  dateKey: string | null;
  slotId: string | null;
  month: Date;
  email: string;
  whatsapp: string;
}): BookingDraft {
  const monthKey = `${args.month.getFullYear()}-${String(args.month.getMonth() + 1).padStart(2, "0")}`;
  return {
    itemId: args.itemId || undefined,
    dateKey: args.dateKey ?? undefined,
    slotId: args.slotId ?? undefined,
    monthKey,
    email: args.email.trim() || undefined,
    whatsapp: args.whatsapp.trim() || undefined,
  };
}
