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
  whatsapp: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    normalizedWhatsappSchema.optional(),
  ),
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
    normalizedWhatsappSchema.optional(),
  ),
  linkPastBookings: z.boolean().optional(),
});

export const adminConfirmOrderSchema = z.object({
  note: z.string().trim().max(800).optional(),
  /** Also create a sales ledger row (credits granted only once). */
  alsoCreateSale: z.boolean().optional(),
  /** Business / paid date (YYYY-MM-DD or ISO). Defaults to confirm time. */
  soldAt: z.string().min(1).optional(),
});

/** Decline a pending package order (no credits granted). */
export const adminCancelOrderSchema = z.object({
  note: z.string().trim().max(800).optional(),
});

/** Admin: edit a paid/pending order (date, amount, credits, note). */
export const adminOrderUpdateSchema = z.object({
  /** Business / paid date (YYYY-MM-DD or ISO). Required for paid orders. */
  paidAt: z.string().min(1).optional(),
  classCount: z.number().int().positive().max(500).optional(),
  amountRm: z.number().nonnegative().max(100_000).optional(),
  note: z.string().trim().max(800).optional(),
});

/** Admin: add a package order on a client (e.g. after register / remaining credits). */
export const adminCreateClientOrderSchema = z.object({
  planId: z.string().min(1),
  /** How many of this plan (e.g. 2 × RM70). Defaults to 1. */
  quantity: z.number().int().min(1).max(50).optional(),
  /** Override total credits. Defaults to plan.classCount × quantity. */
  classCount: z.number().int().positive().max(500).optional(),
  /** Override total amount. Defaults to unit price × quantity. */
  amountRm: z.number().nonnegative().max(100_000).optional(),
  note: z.string().trim().max(800).optional(),
  /** When true (default), mark paid and grant credits immediately. */
  markPaid: z.boolean().optional(),
  /** Also create a sales ledger row (only when markPaid; credits once). */
  alsoCreateSale: z.boolean().optional(),
  /**
   * Business date for paidAt / linked sale (YYYY-MM-DD or ISO).
   * Used when markPaid; defaults to now.
   */
  soldAt: z.string().min(1).optional(),
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
  whatsapp: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    normalizedWhatsappSchema.optional(),
  ),
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
    /** Multi-product lines (preferred for product sales). */
    products: z
      .array(
        z.object({
          productId: z.string().min(1),
          quantity: z.number().int().min(1).max(999).optional(),
        }),
      )
      .min(1)
      .max(50)
      .optional(),
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
    /** Also create a paid package order (plan sales with client+plan only). Credits once. */
    alsoCreateOrder: z.boolean().optional(),
    /**
     * Duet: split into two receipts / payers. When set, creates two sales
     * (each typically per-head amount) linked by saleGroupId.
     */
    splitPayers: z
      .array(
        z.object({
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
          amountRm: z.number().nonnegative(),
          note: z.preprocess(
            (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
            z.string().trim().max(2000).optional(),
          ),
        }),
      )
      .length(2)
      .optional(),
  })
  .superRefine((d, ctx) => {
    const kind = d.saleKind ?? "plan";
    if (kind === "product") {
      const hasLines = Boolean(d.products?.length);
      const hasSingle = Boolean(d.productId);
      if (!hasLines && !hasSingle) {
        ctx.addIssue({
          code: "custom",
          path: ["products"],
          message: "Add at least one product",
        });
      }
    }
    if (d.splitPayers) {
      if (kind !== "plan") {
        ctx.addIssue({
          code: "custom",
          path: ["splitPayers"],
          message: "Split payers is only for plan sales",
        });
      }
      if (!d.planId) {
        ctx.addIssue({
          code: "custom",
          path: ["planId"],
          message: "Plan is required to split Duet receipts",
        });
      }
    }
    if (d.alsoCreateOrder) {
      if (kind !== "plan") {
        ctx.addIssue({
          code: "custom",
          path: ["alsoCreateOrder"],
          message: "alsoCreateOrder is only for plan sales",
        });
      }
      if (!d.splitPayers && !d.clientId) {
        ctx.addIssue({
          code: "custom",
          path: ["clientId"],
          message: "Client is required to also create an order",
        });
      }
      if (!d.planId) {
        ctx.addIssue({
          code: "custom",
          path: ["planId"],
          message: "Plan is required to also create an order",
        });
      }
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

export const adminSaleUpdateSchema = z.object({
  soldAt: z.string().min(1),
  clientName: z.string().trim().min(1).max(200),
  clientEmail: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().email().max(320).optional(),
  ),
  clientWhatsapp: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(120).optional(),
  ),
  quantity: z.number().int().min(1).max(999).optional(),
  classCount: z.number().int().min(0).max(500),
  validityDays: z.number().int().min(0).max(3650),
  listPriceRm: z.number().nonnegative(),
  amountRm: z.number().nonnegative(),
  paymentMethod: z.string().trim().min(1).max(120),
  note: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(2000).optional(),
  ),
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
