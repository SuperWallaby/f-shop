import { ObjectId, type ClientSession, type Collection } from "mongodb";
import type {
  BookingDb,
  ClientDb,
  CreditLedgerDb,
  OrderDb,
  PlanDb,
} from "@/lib/db";
import { normalizeWhatsapp } from "@/lib/whatsapp";

export const DEFAULT_PLANS: Array<
  Omit<PlanDb, "_id" | "createdAt" | "updatedAt">
> = [
  {
    code: "group-mat-single",
    title: "Group Mat - Single Class",
    cardTitle: "Single Class",
    category: "group_mat",
    classCount: 1,
    priceRm: 50,
    studentPriceRm: 44,
    firstTimerPriceRm: 35,
    validityDays: 30,
    active: true,
    sortOrder: 10,
    detailLines: [
      "First timer 30% off (RM 35)",
      "Non-shareable",
      "Non-refundable",
    ],
  },
  {
    code: "group-mat-4",
    title: "Group Mat - 4 Classes",
    cardTitle: "4 Classes",
    category: "group_mat",
    classCount: 4,
    priceRm: 160,
    studentPriceRm: 141,
    validityDays: 30,
    active: true,
    sortOrder: 20,
    detailLines: ["1 Month Validity", "Non-shareable", "Non-refundable"],
  },
  {
    code: "group-mat-8",
    title: "Group Mat - 8 Classes",
    cardTitle: "8 Classes",
    category: "group_mat",
    classCount: 8,
    priceRm: 280,
    studentPriceRm: 246,
    validityDays: 60,
    active: true,
    sortOrder: 30,
    detailLines: ["2 Month Validity", "Non-shareable", "Non-refundable"],
  },
  {
    code: "mat-private-single",
    title: "Mat Private - Single Class",
    cardTitle: "Single Class",
    category: "mat_private",
    classCount: 1,
    priceRm: 70,
    firstTimerPriceRm: 59.5,
    validityDays: 30,
    active: true,
    sortOrder: 35,
    detailLines: [
      "First timer 15% off (RM 59.50)",
      "Single class only — no package",
      "Non-shareable",
      "Non-refundable",
    ],
  },
  {
    code: "reformer-private-single",
    title: "Reformer Private - Single Class",
    cardTitle: "Single Class",
    category: "reformer_private",
    classCount: 1,
    priceRm: 170,
    firstTimerPriceRm: 153,
    validityDays: 30,
    active: true,
    sortOrder: 40,
    detailLines: ["First timer 10% off", "Non-shareable", "Non-refundable"],
  },
  {
    code: "reformer-private-3",
    title: "Reformer Private - 3 Classes",
    cardTitle: "3 Classes",
    category: "reformer_private",
    classCount: 3,
    priceRm: 480,
    validityDays: 30,
    active: true,
    sortOrder: 50,
    detailLines: ["1 Month Validity", "Non-shareable", "Non-refundable"],
  },
  {
    code: "reformer-private-10",
    title: "Reformer Private - 10 Classes",
    cardTitle: "10 Classes",
    category: "reformer_private",
    classCount: 10,
    priceRm: 1500,
    validityDays: 90,
    active: true,
    sortOrder: 60,
    detailLines: ["3 Month Validity", "Non-shareable", "Non-refundable"],
  },
  {
    code: "pre-post-reformer-single",
    title: "Pre and Post Reformer Pilates - Single Session",
    cardTitle: "Single Session",
    category: "pre_post_reformer",
    classCount: 1,
    priceRm: 150,
    firstTimerPriceRm: 135,
    validityDays: 30,
    active: true,
    sortOrder: 65,
    detailLines: [
      "First timer 10% off (RM 135)",
      "Single session only — no package",
      "Non-shareable",
      "Non-refundable",
    ],
  },
  {
    code: "duet-single",
    title: "Duet - Single Class",
    cardTitle: "Single Class",
    category: "duet",
    classCount: 1,
    priceRm: 120,
    firstTimerPriceRm: 108,
    validityDays: 30,
    active: true,
    sortOrder: 70,
    priceNote: "/ per head",
    detailLines: [
      "First timer 10% off (RM 108)",
      "Non-shareable",
      "Non-refundable",
    ],
  },
  {
    code: "duet-4",
    title: "Duet - 4 Classes",
    cardTitle: "4 Classes",
    category: "duet",
    classCount: 4,
    priceRm: 460,
    validityDays: 30,
    active: true,
    sortOrder: 80,
    priceNote: "/ per head",
    detailLines: ["1 Month Validity", "Non-shareable", "Non-refundable"],
  },
  {
    code: "duet-8",
    title: "Duet - 8 Classes",
    cardTitle: "8 Classes",
    category: "duet",
    classCount: 8,
    priceRm: 880,
    validityDays: 60,
    active: true,
    sortOrder: 90,
    priceNote: "/ per head",
    detailLines: ["2 Month Validity", "Non-shareable", "Non-refundable"],
  },
  {
    code: "reformer-group-single",
    title: "Reformer Group - Single Class",
    cardTitle: "Single Class",
    category: "reformer_group",
    classCount: 1,
    priceRm: 90,
    studentPriceRm: 79,
    firstTimerPriceRm: 81,
    listPriceRm: 90,
    validityDays: 30,
    active: true,
    sortOrder: 100,
    promotionActive: false,
    promotionDiscount: "RM 81",
    promotionLabel: "Promo price",
    detailLines: ["First timer 10% off", "Non-shareable", "Non-refundable"],
  },
  {
    code: "reformer-group-4",
    title: "Reformer Group - 4 Classes",
    cardTitle: "4 Classes",
    category: "reformer_group",
    classCount: 4,
    priceRm: 348,
    studentPriceRm: 306,
    validityDays: 60,
    active: true,
    sortOrder: 110,
    detailLines: ["2 Month Validity", "Non-shareable", "Non-refundable"],
  },
  {
    code: "reformer-group-8",
    title: "Reformer Group - 8 Classes",
    cardTitle: "8 Classes",
    category: "reformer_group",
    classCount: 8,
    priceRm: 664,
    studentPriceRm: 584,
    validityDays: 90,
    active: true,
    sortOrder: 120,
    detailLines: ["3 Month Validity", "Non-shareable", "Non-refundable"],
  },
];

export function makeCustomerKey(args: { email?: string; whatsapp?: string }) {
  const whatsapp = normalizeWhatsapp(args.whatsapp ?? "");
  if (whatsapp) return `wa:${whatsapp}`;
  const email = (args.email ?? "").trim().toLowerCase();
  if (email) return `em:${email}`;
  return "";
}

export function publicClient(client: { _id?: ObjectId } & ClientDb) {
  return {
    id: client._id?.toHexString() ?? "",
    name: client.name,
    email: client.email,
    whatsapp: client.whatsapp,
    studentStatus: client.studentStatus,
    hasPassword: Boolean(client.passwordHash),
    pushMarketingOptIn: client.pushMarketingOptIn ?? true,
    studentName: client.studentName ?? "",
    studentAge: client.studentAge ?? null,
    schoolName: client.schoolName ?? "",
    studentId: client.studentId ?? "",
    universityEndYear: client.universityEndYear ?? null,
    createdAt: client.createdAt?.toISOString?.() ?? "",
  };
}

/** Inserts missing plan codes only; does not overwrite existing rows (Admin is source of truth). */
export async function ensureDefaultPlans(plans: Collection<PlanDb>) {
  const now = new Date();
  await Promise.all(
    DEFAULT_PLANS.map(async (plan) => {
      await plans.updateOne(
        { code: plan.code },
        {
          $setOnInsert: {
            ...plan,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
      // Backfill first-timer price on existing default plans when missing.
      if (typeof plan.firstTimerPriceRm === "number") {
        await plans.updateOne(
          {
            code: plan.code,
            firstTimerPriceRm: { $exists: false },
          },
          {
            $set: {
              firstTimerPriceRm: plan.firstTimerPriceRm,
              updatedAt: now,
            },
          },
        );
      }
    }),
  );
}

/** Resolve first-timer RM from plan field or detail-line text. */
export function resolveFirstTimerPriceRm(
  plan: Pick<PlanDb, "priceRm" | "firstTimerPriceRm" | "detailLines">,
): number | null {
  if (
    typeof plan.firstTimerPriceRm === "number" &&
    Number.isFinite(plan.firstTimerPriceRm) &&
    plan.firstTimerPriceRm >= 0
  ) {
    return plan.firstTimerPriceRm;
  }
  for (const line of plan.detailLines ?? []) {
    const rm = line.match(/first\s*timer.*?RM\s*(\d+(?:\.\d+)?)/i);
    if (rm) return Number(rm[1]);
    const pct = line.match(/first\s*timer\s*(\d+)\s*%\s*off/i);
    if (pct) {
      const p = Math.min(100, Math.max(0, Number(pct[1])));
      return Math.round(plan.priceRm * (100 - p) * 100) / 100;
    }
  }
  return null;
}

export type PlanPriceMode = "regular" | "student" | "first_timer";

export function resolvePlanListPriceRm(
  plan: Pick<
    PlanDb,
    "priceRm" | "studentPriceRm" | "firstTimerPriceRm" | "detailLines"
  >,
  mode: PlanPriceMode,
): number {
  if (
    mode === "student" &&
    typeof plan.studentPriceRm === "number" &&
    plan.studentPriceRm >= 0
  ) {
    return plan.studentPriceRm;
  }
  if (mode === "first_timer") {
    const ft = resolveFirstTimerPriceRm(plan);
    if (ft != null) return ft;
  }
  return plan.priceRm;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Serialized credit-expiry windows for member + admin UI. */
export type PublicExpiryAlert = {
  expiresAt: string;
  windowStart: string;
  windowEnd: string;
  credits: number;
  expiryApproved: boolean;
  showBanner: boolean;
  ledgerIds: string[];
};

/**
 * Positive grants past expiresAt count only when expiryApproved === false (grace).
 * Legacy rows (expiryApproved unset) that are past expiry stay excluded from balance.
 */
export function ledgerRowCountsTowardBalance(row: CreditLedgerDb, now: Date): boolean {
  if (row.amount < 0) return true;
  if (row.amount <= 0) return false;
  if (!row.expiresAt) return true;
  if (row.expiresAt > now) return true;
  return row.expiryApproved === false;
}

function buildExpiryAlerts(countingRows: CreditLedgerDb[], now: Date): PublicExpiryAlert[] {
  const grants = countingRows.filter((r) => r.amount > 0 && r.expiresAt);
  const byExpiry = new Map<number, CreditLedgerDb[]>();
  for (const r of grants) {
    const k = r.expiresAt!.getTime();
    const list = byExpiry.get(k) ?? [];
    list.push(r);
    byExpiry.set(k, list);
  }
  const out: PublicExpiryAlert[] = [];
  for (const [, list] of byExpiry) {
    const credits = list.reduce((s, r) => s + r.amount, 0);
    if (credits <= 0) continue;
    const exp = list[0].expiresAt!;
    const windowStart = new Date(exp.getTime() - 7 * MS_PER_DAY);
    const windowEnd = new Date(exp.getTime() + 7 * MS_PER_DAY);
    const t = now.getTime();
    const showBanner = t >= windowStart.getTime() && t <= windowEnd.getTime();
    const expiryApproved =
      list.length > 0 && list.every((r) => r.expiryApproved === true);
    out.push({
      expiresAt: exp.toISOString(),
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      credits,
      expiryApproved,
      showBanner,
      ledgerIds: list.map((r) => r._id!.toHexString()),
    });
  }
  out.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  return out;
}

export async function getCreditBalance(args: {
  creditLedger: Collection<CreditLedgerDb>;
  clientId: ObjectId;
  now?: Date;
  session?: ClientSession;
}) {
  const now = args.now ?? new Date();
  const rows = await args.creditLedger
    .find({ clientId: args.clientId }, { session: args.session })
    .toArray();

  const countingRows = rows.filter((row) => ledgerRowCountsTowardBalance(row, now));
  const balance = countingRows.reduce((sum, row) => sum + row.amount, 0);
  const expiringCredits = countingRows
    .filter((row) => row.amount > 0 && row.expiresAt)
    .sort((a, b) => a.expiresAt!.getTime() - b.expiresAt!.getTime())
    .map((row) => ({
      amount: row.amount,
      expiresAt: row.expiresAt!,
      source: row.type,
      expiryApproved: row.expiryApproved === true,
    }));

  const expiryAlerts = buildExpiryAlerts(countingRows, now);

  return {
    balance: Math.max(0, balance),
    rawBalance: balance,
    expiringCredits,
    expiryAlerts,
  };
}

/** Deduct 1 credit for a confirmed booking. Allows overdraft (pay later). Idempotent per booking. */
export async function insertBookingConsume(args: {
  creditLedger: Collection<CreditLedgerDb>;
  clientId: ObjectId;
  bookingId: ObjectId;
  now?: Date;
  note?: string;
}) {
  const now = args.now ?? new Date();
  const existing = await args.creditLedger.findOne({
    bookingId: args.bookingId,
    type: "booking_consume",
    amount: { $lt: 0 },
  });
  if (existing) return { inserted: false as const, id: existing._id! };

  const ins = await args.creditLedger.insertOne({
    clientId: args.clientId,
    type: "booking_consume",
    amount: -1,
    bookingId: args.bookingId,
    note: args.note ?? "Class booking",
    createdAt: now,
  });
  return { inserted: true as const, id: ins.insertedId };
}

/** Restore credits after cancel when a consume exists. Idempotent per booking. */
export async function insertBookingCancelRefund(args: {
  creditLedger: Collection<CreditLedgerDb>;
  clientId: ObjectId;
  bookingId: ObjectId;
  now?: Date;
  note?: string;
}) {
  const now = args.now ?? new Date();
  const already = await args.creditLedger.findOne({
    bookingId: args.bookingId,
    type: "booking_cancel_refund",
  });
  if (already) return { inserted: false as const, id: already._id! };

  const consumed = await args.creditLedger.findOne({
    bookingId: args.bookingId,
    type: "booking_consume",
    amount: { $lt: 0 },
  });
  if (!consumed || consumed.amount >= 0) {
    return { inserted: false as const, id: null };
  }

  const ins = await args.creditLedger.insertOne({
    clientId: args.clientId,
    type: "booking_cancel_refund",
    amount: -consumed.amount,
    bookingId: args.bookingId,
    note: args.note ?? "Credit restored after cancellation",
    createdAt: now,
  });
  return { inserted: true as const, id: ins.insertedId };
}

/** For confirmed/no-show bookings linked to a client, ensure each has a consume row. */
export async function backfillBookingConsumesForClient(args: {
  bookings: Collection<BookingDb>;
  creditLedger: Collection<CreditLedgerDb>;
  clientId: ObjectId;
  now?: Date;
  note?: string;
}) {
  const now = args.now ?? new Date();
  const rows = await args.bookings
    .find({
      clientId: args.clientId,
      status: { $in: ["confirmed", "no_show"] },
    })
    .project({ _id: 1 })
    .toArray();
  if (rows.length === 0) return { inserted: 0, checked: 0 };

  const bookingIds = rows.map((r) => r._id!).filter(Boolean);
  const existing = await args.creditLedger
    .find({
      bookingId: { $in: bookingIds },
      type: "booking_consume",
      amount: { $lt: 0 },
    })
    .project({ bookingId: 1 })
    .toArray();
  const hasConsume = new Set(
    existing.map((e) => e.bookingId?.toHexString()).filter(Boolean),
  );

  let inserted = 0;
  for (const bookingId of bookingIds) {
    if (hasConsume.has(bookingId.toHexString())) continue;
    const res = await insertBookingConsume({
      creditLedger: args.creditLedger,
      clientId: args.clientId,
      bookingId,
      now,
      note: args.note ?? "Linked past booking",
    });
    if (res.inserted) inserted += 1;
  }
  return { inserted, checked: bookingIds.length };
}

export function createOrderRef() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `FS${Date.now().toString(36).toUpperCase()}${n}`;
}

export function getOrderAmountForClient(plan: PlanDb, client: ClientDb) {
  if (client.studentStatus === "verified" && typeof plan.studentPriceRm === "number") {
    return plan.studentPriceRm;
  }
  return plan.priceRm;
}

export function buildPaymentWhatsappMessage(args: {
  client: ClientDb;
  plan: PlanDb;
  order: Pick<OrderDb, "orderRef" | "amountRm">;
}) {
  return [
    "Hi Fasea, I would like to make payment for this package.",
    `Order: ${args.order.orderRef}`,
    `Name: ${args.client.name}`,
    `Plan: ${args.plan.title}`,
    `Amount: RM ${args.order.amountRm}`,
    `Credits: ${args.plan.classCount}`,
  ].join("\n");
}

export function formatPlanPriceRm(rm: number): string {
  return `RM ${rm.toLocaleString("en-MY")}`;
}
