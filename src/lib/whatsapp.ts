import { z } from "zod";

// Normalize WhatsApp numbers so DB values are consistent:
// - keep leading '+', if present
// - remove spaces, dashes, parentheses
// - keep digits only (and optional leading '+')
export function normalizeWhatsapp(input: string): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  const leadingPlus = raw.startsWith("+");
  const digits = raw.replace(/[^0-9]/g, "");
  const out = (leadingPlus ? "+" : "") + digits;
  return out;
}

export const normalizedWhatsappSchema = z
  .string()
  .transform((v) => normalizeWhatsapp(v))
  .refine((v) => v.length >= 6 && v.length <= 32, "Invalid WhatsApp number")
  .refine((v) => /^[+0-9][0-9]*$/.test(v), "Invalid WhatsApp number");

