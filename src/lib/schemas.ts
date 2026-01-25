import { z } from "zod";
import { normalizedWhatsappSchema } from "./whatsapp";

export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const minuteOfDaySchema = z
  .number()
  .int()
  .min(0)
  .max(24 * 60);

export const weeklyPatternItemSchema = z.object({
  startMin: minuteOfDaySchema,
  endMin: minuteOfDaySchema,
  itemId: z.string().min(1),
});

export const weeklyPatternSchema = z.record(
  z.string().regex(/^[0-6]$/),
  z.array(weeklyPatternItemSchema)
);

export const adminLoginSchema = z.object({
  password: z.string().min(1),
});

const optionalQueryItemIdSchema = z.preprocess((v) => {
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().min(1).optional());

export const publicSlotsQuerySchema = z.object({
  dateKey: dateKeySchema,
  itemId: optionalQueryItemIdSchema,
});

export const publicAvailableDatesQuerySchema = z.object({
  fromDateKey: dateKeySchema,
  toDateKey: dateKeySchema,
  itemId: optionalQueryItemIdSchema,
});

// Used by admin/public calendar views (not item-scoped)
export const calendarRangeQuerySchema = z.object({
  fromDateKey: dateKeySchema,
  toDateKey: dateKeySchema,
});

export const createBookingSchema = z.object({
  slotId: z.string().min(1),
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  whatsapp: normalizedWhatsappSchema,
  consentWhatsapp: z.boolean().optional(),
  marketingOptIn: z.boolean().optional(),
});

export const publicBookingLookupQuerySchema = z
  .object({
    code: z.string().trim().regex(/^\d{6}$/).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().email().max(320).optional(),
    whatsapp: normalizedWhatsappSchema.optional(),
  })
  .refine(
    (v) => {
      if (v.code) return true;
      if (!v.name) return false;
      return Boolean(v.email || v.whatsapp);
    },
    { message: "Provide code, or name + (email or whatsapp)" }
  );

export const publicCancelBookingSchema = z
  .object({
    code: z.string().trim().regex(/^\d{6}$/),
    email: z.string().trim().email().max(320).optional(),
    whatsapp: normalizedWhatsappSchema.optional(),
  })
  .refine((v) => Boolean(v.email || v.whatsapp), {
    message: "Provide email or whatsapp",
  });

export const adminGenerateSlotsSchema = z.object({
  fromDateKey: dateKeySchema,
  toDateKey: dateKeySchema,
  force: z.boolean().optional(),
  replaceOverlaps: z.boolean().optional(),
});

export const adminUpdateSettingsSchema = z.object({
  businessTimeZone: z.string().min(1),
  weeklyPattern: weeklyPatternSchema,
  // Safety valve: allow intentionally wiping weeklyPattern even if an existing pattern is present.
  // (Server will reject accidental empty overwrites unless this is true.)
  confirmEmptyWeeklyPattern: z.boolean().optional(),
  bookingRules: z
    .object({
      minNoticeHours: z.number().int().min(0).max(24 * 365),
      maxDaysAhead: z.number().int().min(1).max(3650),
    })
    .optional(),
});

export const adminCreateSlotSchema = z.object({
  dateKey: dateKeySchema,
  itemId: z.string().min(1),
  startMin: minuteOfDaySchema,
  endMin: minuteOfDaySchema,
});

export const adminUpdateSlotSchema = z.object({
  itemId: z.string().min(1).optional(),
  startMin: minuteOfDaySchema.optional(),
  endMin: minuteOfDaySchema.optional(),
  cancelled: z.boolean().optional(),
});

