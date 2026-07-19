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

export const createBookingSchema = z
  .object({
    slotId: z.string().min(1),
    name: z.string().min(1).max(200),
    email: z.string().email().max(320),
    whatsapp: normalizedWhatsappSchema,
    consentWhatsapp: z.boolean().optional(),
    marketingOptIn: z.boolean().optional(),
    signUp: z.boolean().optional(),
    password: z.string().regex(/^\d{4}$/).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.signUp && !v.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a 4-digit password to create an account.",
        path: ["password"],
      });
    }
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

export const publicCancelBookingSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
  email: z.string().trim().email().max(320).optional(),
  whatsapp: normalizedWhatsappSchema.optional(),
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

export const googleMobileAuthSchema = z.object({
  idToken: z.string().min(10),
});

export const pushTokenRegisterSchema = z.object({
  token: z.string().min(20),
  platform: z.enum(["ios", "android", "web"]),
});

export const pushPreferencesSchema = z.object({
  pushMarketingOptIn: z.boolean(),
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
  "mat_private",
  "reformer_private",
  "pre_post_reformer",
  "duet",
  "reformer_group",
]);

export const clientAuthEmailSchema = z.object({
  email: z.string().trim().email().max(320),
  name: z.string().trim().max(200).optional(),
  password: z.string().regex(/^\d{4}$/).optional(),
});

export const clientAuthPasswordLoginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().regex(/^\d{4}$/),
});

export const clientAuthSignupSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().regex(/^\d{4}$/),
  name: z.string().trim().max(200).optional(),
  whatsapp: z.string().trim().max(120).optional(),
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

/** Admin: register a client from a past booking contact (credits/purchases added later). */
export const adminRegisterClientSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  whatsapp: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(120).optional(),
  ),
  linkPastBookings: z.boolean().optional(),
});

export const adminConfirmOrderSchema = z.object({
  note: z.string().trim().max(800).optional(),
});

/** Decline a pending package order (no credits granted). */
export const adminCancelOrderSchema = adminConfirmOrderSchema;

/** Admin: add a package order on a client (e.g. after register / remaining credits). */
export const adminCreateClientOrderSchema = z.object({
  planId: z.string().min(1),
  /** Override plan classCount (e.g. remaining credits). Defaults to plan.classCount. */
  classCount: z.number().int().positive().max(500).optional(),
  /** Override amount. Defaults to client-appropriate plan price. */
  amountRm: z.number().nonnegative().max(100_000).optional(),
  note: z.string().trim().max(800).optional(),
  /** When true (default), mark paid and grant credits immediately. */
  markPaid: z.boolean().optional(),
});

export const adminDeleteClientSchema = z.object({
  /** Must match the client's email (case-insensitive) to proceed. */
  confirmEmail: z.string().trim().email().max(320),
});

export const adminExpiryApprovalSchema = z.object({
  ledgerIds: z.array(z.string().min(1)).min(1),
  approved: z.boolean(),
});

export const adminPlanCreateSchema = z.object({
  /** Auto-generated from title when omitted. */
  code: z.string().trim().min(1).max(80).optional(),
  title: z.string().trim().min(1).max(200),
  cardTitle: z.string().trim().max(120).nullable().optional(),
  category: planCategorySchema,
  classCount: z.number().int().min(1).max(500),
  priceRm: z.number().nonnegative(),
  studentPriceRm: z.number().nonnegative().nullable().optional(),
  firstTimerPriceRm: z.number().nonnegative().nullable().optional(),
  listPriceRm: z.number().nonnegative().nullable().optional(),
  validityDays: z.number().int().min(1).max(3650),
  active: z.boolean().optional(),
  /** Usable in admin/sales but omitted from customer-facing plan lists. */
  hidden: z.boolean().optional(),
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

export const dataDeletionRequestSchema = z.object({
  email: z.string().trim().email().max(320),
  name: z.string().trim().max(200).optional(),
  whatsapp: z.string().trim().max(120).optional(),
  message: z.string().trim().max(2000).optional(),
  confirm: z.boolean(),
}).refine((v) => v.confirm === true, {
  message: "Please confirm your deletion request.",
  path: ["confirm"],
});

export const adminPromotionCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  discountType: z.enum(["fixed", "percent", "other"]),
  discountValue: z.number().nonnegative().optional(),
  discountLabel: z.string().trim().max(200).optional(),
  badgeLabel: z.string().trim().max(80).optional(),
  planIds: z.array(z.string().min(1)).max(50).optional(),
  imageUrl: z
    .union([
      z.string().url().max(2048),
      z.string().regex(/^data:image\/(png|jpeg|jpg|webp|gif);base64,/).max(1_200_000),
      z.literal(""),
    ])
    .optional(),
  showAsModal: z.boolean().optional(),
  modalLink: z.union([z.string().url().max(2048), z.literal("")]).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const adminPromotionPatchSchema = adminPromotionCreateSchema.partial();

export const adminShopProductCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  priceRm: z.number().nonnegative().max(1_000_000),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const adminShopProductPatchSchema = adminShopProductCreateSchema.partial();

export const adminSaleCreateSchema = z
  .object({
    soldAt: z.string().min(1),
    clientId: z.string().min(1).optional(),
    clientName: z.string().trim().min(1).max(200),
    clientEmail: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().trim().email().max(320).optional(),
    ),
    clientWhatsapp: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().trim().max(120).optional(),
    ),
    saleKind: z.enum(["plan", "product"]).optional(),
    itemId: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().min(1).optional(),
    ),
    planId: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().min(1).optional(),
    ),
    productId: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().min(1).optional(),
    ),
    quantity: z.number().int().min(1).max(999).optional(),
    classCount: z.number().int().min(0).max(500),
    validityDays: z.number().int().min(0).max(3650),
    promotionId: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().min(1).optional(),
    ),
    listPriceRm: z.number().nonnegative(),
    computedAmountRm: z.number().nonnegative(),
    amountRm: z.number().nonnegative(),
    amountOverridden: z.boolean().optional(),
    note: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().trim().max(2000).optional(),
    ),
    useStudentPrice: z.boolean().optional(),
    priceMode: z.enum(["regular", "student", "first_timer"]).optional(),
  })
  .superRefine((d, ctx) => {
    const kind = d.saleKind ?? "plan";
    if (kind === "product" && !d.productId) {
      ctx.addIssue({
        code: "custom",
        path: ["productId"],
        message: "Product is required for product sales",
      });
    }
  });

export const adminSaleRefundSchema = z.object({
  refundAmountRm: z.number().nonnegative().optional(),
  refundNote: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(2000).optional(),
  ),
  recallCredits: z.boolean().optional(),
});

export const adminSalesListQuerySchema = z.object({
  from: dateKeySchema.optional(),
  to: dateKeySchema.optional(),
  status: z.enum(["paid", "refunded", "all"]).optional(),
});

export const adminSalesStatsQuerySchema = z.object({
  from: dateKeySchema,
  to: dateKeySchema,
});

export const adminCashTxnCreateSchema = z.object({
  kind: z.enum(["income", "expense"]),
  occurredAt: z.string().min(1),
  amountRm: z.number().positive(),
  category: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  note: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(2000).optional(),
  ),
});

export const adminCashTxnListQuerySchema = z.object({
  from: dateKeySchema.optional(),
  to: dateKeySchema.optional(),
  status: z.enum(["recorded", "voided", "all"]).optional(),
  kind: z.enum(["income", "expense", "all"]).optional(),
});
