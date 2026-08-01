import { z } from "zod";

/** Digits only, with MY local `0…` rewritten to `60…`. */
export function whatsappDigitsCanonical(input: string): string {
  let digits = String(input ?? "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  // Local Malaysia mobile (01x…) → country code 60
  if (digits.startsWith("0") && !digits.startsWith("00")) {
    digits = `60${digits.slice(1)}`;
  }
  return digits;
}

/**
 * Canonical WhatsApp for storage / Twilio E.164.
 * Strips spaces, dashes, and leading `+`; always returns `+` + digits
 * (so `+6014…` and `6014…` become the same value).
 */
export function normalizeWhatsapp(input: string): string {
  const digits = whatsappDigitsCanonical(input);
  if (!digits) return "";
  return `+${digits}`;
}

/** Fields to store on ClientDb for display + unique matching. */
export function clientWhatsappFields(input: string): {
  whatsapp: string;
  whatsappDigits: string;
} | null {
  const whatsappDigits = whatsappDigitsCanonical(input);
  if (!whatsappDigits) return null;
  return { whatsapp: `+${whatsappDigits}`, whatsappDigits };
}

/**
 * Legacy + canonical forms that may already exist in the DB.
 * Same person often typed as +6012… / 6012… / 012… / 006012…
 */
export function whatsappStorageVariants(input: string): string[] {
  const digits = whatsappDigitsCanonical(input);
  if (!digits) return [];
  const variants = new Set<string>([
    `+${digits}`,
    digits,
    `00${digits}`,
  ]);
  if (digits.startsWith("60") && digits.length > 2) {
    const local = `0${digits.slice(2)}`;
    variants.add(local);
    variants.add(`+${local}`);
    variants.add(`60${digits.slice(2)}`); // same as digits when already 60…
  }
  // Also keep raw digits before MY local rewrite, if input was 0…
  const rawDigits = String(input ?? "").replace(/[^0-9]/g, "");
  if (rawDigits && rawDigits !== digits) {
    variants.add(rawDigits);
    variants.add(`+${rawDigits}`);
    variants.add(`00${rawDigits}`);
  }
  return [...variants];
}

export function whatsappsMatch(a: string, b: string): boolean {
  const da = whatsappDigitsCanonical(a);
  const db = whatsappDigitsCanonical(b);
  return Boolean(da && db && da === db);
}

export const normalizedWhatsappSchema = z
  .string()
  .transform((v) => normalizeWhatsapp(v))
  .refine((v) => {
    const d = whatsappDigitsCanonical(v);
    return d.length >= 8 && d.length <= 15;
  }, "Invalid WhatsApp number")
  .refine((v) => /^\+[0-9]+$/.test(v), "Invalid WhatsApp number");
