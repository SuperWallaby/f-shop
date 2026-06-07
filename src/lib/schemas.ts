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

const optionalBodyItemIdSchema = z.preprocess((v) => {
  if (v === null || v === undefined) return undefined;
  if (typeof v !== "string") return v;
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
  itemId: optionalBodyItemIdSchema,
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

/** Public bookings: authenticated client session + optional WhatsApp override (otherwise profile WhatsApp). */
export const publicMemberBookingSchema = z.object({
  slotId: z.string().min(1),
  whatsapp: normalizedWhatsappSchema.optional(),
  consentWhatsapp: z.literal(true),
  marketingOptIn: z.boolean().optional(),
});

export const planCategorySchema = z.enum([
  "group_mat",
  "reformer_private",
  "duet",
  "reformer_group",
]);

export const clientAuthEmailSchema = z.object({
  email: z.string().trim().email().max(320),
  name: z.string().trim().max(200).optional(),
});

export const clientAuthRecoverSchema = z.object({
  name: z.string().trim().min(1).max(200),
  whatsapp: normalizedWhatsappSchema,
});

export const clientProfileNameSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const publicCreateOrderSchema = z.object({
  planId: z.string().min(1),
});

export const adminAdjustCreditSchema = z.object({
  amount: z.number().int(),
  note: z.string().trim().max(800),
  expiresAt: z.string().datetime().optional(),
});

export const adminConfirmOrderSchema = z.object({
  note: z.string().trim().max(800).optional(),
});

/** Decline a pending package order (no credits granted). */
export const adminCancelOrderSchema = adminConfirmOrderSchema;

export const adminDeleteClientSchema = z.object({
  /** Must match the client's email (case-insensitive) to proceed. */
  confirmEmail: z.string().trim().email().max(320),
});

export const adminExpiryApprovalSchema = z.object({
  ledgerIds: z.array(z.string().min(1)).min(1),
  approved: z.boolean(),
});

export const adminPlanCreateSchema = z.object({
  code: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  cardTitle: z.string().trim().max(120).nullable().optional(),
  category: planCategorySchema,
  classCount: z.number().int().min(1).max(500),
  priceRm: z.number().nonnegative(),
  studentPriceRm: z.number().nonnegative().nullable().optional(),
  listPriceRm: z.number().nonnegative().nullable().optional(),
  validityDays: z.number().int().min(1).max(3650),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  detailLines: z.array(z.string().trim().max(500)).optional().default([]),
  priceNote: z.string().trim().max(200).nullable().optional(),
  promotionActive: z.boolean().optional(),
  promotionDiscount: z.string().trim().max(160).nullable().optional(),
  promotionLabel: z.string().trim().max(160).nullable().optional(),
});

export const adminPlanPatchSchema = adminPlanCreateSchema.partial();

export const adminEventCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(900),
  description: z.string().trim().max(20000).optional(),
  imageUrl: z.union([z.string().url().max(2048), z.literal("")]).optional(),
  startsAt: z.union([z.string().datetime(), z.literal("")]).optional(),
  endsAt: z.union([z.string().datetime(), z.literal("")]).optional(),
  location: z.string().trim().max(500).optional(),
  priceLabel: z.string().trim().max(200).optional(),
  capacityLabel: z.string().trim().max(200).optional(),
  whatsappText: z.string().trim().max(4000).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const adminEventPatchSchema = adminEventCreateSchema.partial();

export const adminUpdateClientSchema = z.object({
  name: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(320).optional(),
  whatsapp: z.string().max(120).optional(),
  studentStatus: z.enum(["none", "pending", "verified", "rejected"]).optional(),
  studentName: z.string().trim().max(200).optional(),
  studentAge: z.number().nullable().optional(),
  schoolName: z.string().trim().max(200).optional(),
  studentId: z.string().trim().max(200).optional(),
  universityEndYear: z.number().int().nullable().optional(),
}).strict();

