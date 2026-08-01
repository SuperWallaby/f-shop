import {
 MongoClient,
 type Db,
 type Collection,
 type Filter,
 ObjectId,
 type WithId,
} from "mongodb";
import { optionalEnv, requireEnv } from "./env";

export type SettingsDoc = {
 _id: "singleton";
 businessTimeZone: string; // IANA tz, e.g. Asia/Seoul
 weeklyPattern: Record<
  string,
  Array<{
   startMin: number;
   endMin: number;
   itemId: string; // hex string; generator will validate/convert
  }>
 >;
 bookingRules?: {
  minNoticeHours: number; // minimum hours before slot start
  maxDaysAhead: number; // max days ahead (inclusive) user can book
 };
 /** One-time: merge clients that shared +60… / 60… WhatsApp variants. */
 whatsappDedupeV1Done?: boolean;
 /** Re-run merge with expanded phone variants (+60 / 60 / 0… / 00…). */
 whatsappDedupeV2Done?: boolean;
 updatedAt: Date;
};

export type SettingsHistoryDb = {
 _id?: ObjectId;
 settingsId: "singleton";
 createdAt: Date;
 // Snapshot before/after. Stored as plain objects for easy inspection/debugging.
 prev: SettingsDoc | null;
 next: SettingsDoc;
};

export type ItemDb = {
 _id?: ObjectId;
 name: string;
 description: string;
 capacity: number;
 // Display order for UI lists (lower comes first)
 sortOrder?: number;
 // Optional pastel color used in UI for this class type (e.g. '#f6d6d8')
 color?: string;
 // Optional: auto-cancel rule. If enabled, sessions for this class type will be auto-cancelled
 // when confirmed bookings are below minBookings at cutoffHoursBeforeStart hours before start.
 autoCancelEnabled?: boolean;
 autoCancelMinBookings?: number;
 autoCancelCutoffHours?: number;
 // If set, items sharing the same exclusiveKey are mutually exclusive for the same date/time.
 // A confirmed booking in any item with this key blocks all others at the same time.
 exclusiveKey?: string;
 active: boolean;
 createdAt: Date;
 updatedAt: Date;
};

export type TimeSlotDb = {
 _id?: ObjectId;
 dateKey: string; // YYYY-MM-DD in businessTimeZone
 itemId: ObjectId;
 startMin: number;
 endMin: number;
 bookedCount: number;
 cancelled: boolean;
 createdAt: Date;
 updatedAt: Date;
};

export type BookingDb = {
 _id?: ObjectId;
 code?: string; // 6-digit public booking code (unique). Optional for legacy docs.
 slotId?: ObjectId | null;
 detached?: boolean;
 detachedAt?: Date | null;
 detachedFromSlotId?: ObjectId;
 itemId: ObjectId;
 /** Present for member bookings (credit-backed). Guest / admin-only rows omit. */
 clientId?: ObjectId;
 // snapshot of item's exclusiveKey at booking time (used for mutual-exclusion enforcement)
 exclusiveKey?: string;
 name: string;
 email: string;
 whatsapp: string;
 // Consent flags (public booking UI)
 consentWhatsapp?: boolean;
 marketingOptIn?: boolean;
 marketingOptInAt?: Date;
 adminNote?: string;
 // Admin-only: mark bookings you want to pay attention to (star/pin).
 starred?: boolean;
 status: "confirmed" | "cancelled" | "no_show";
 createdAt: Date;
 cancelledAt?: Date;
 noShowAt?: Date;
 reminderSentAt?: Date;
 // snapshots (for emails/history)
 dateKey: string;
 startMin: number;
 endMin: number;
 businessTimeZone: string;
 capacityAtBooking: number;
};

export type PlanCategory =
 | "group_mat"
 | "mat_private"
 | "reformer_private"
 | "pre_post_reformer"
 | "duet"
 | "reformer_group";

export type PlanDb = {
 _id?: ObjectId;
 code: string;
 title: string;
 cardTitle?: string;
 category: PlanCategory;
 classCount: number;
 priceRm: number;
 studentPriceRm?: number;
 /** First-visit / first-timer package price (often single-class only). */
 firstTimerPriceRm?: number;
 listPriceRm?: number;
 validityDays: number;
 active: boolean;
 /** When true, plan is usable in admin/sales but hidden from customer plan lists. */
 hidden?: boolean;
 sortOrder: number;
 detailLines?: string[];
 priceNote?: string;
 promotionActive?: boolean;
 promotionDiscount?: string;
 promotionLabel?: string;
 createdAt: Date;
 updatedAt: Date;
};

export type OrderDb = {
 _id?: ObjectId;
 orderRef: string;
 clientId: ObjectId;
 planId: ObjectId;
 planCode: string;
 planTitle: string;
 /** Pack count (how many of this plan). Defaults to 1 for legacy rows. */
 quantity?: number;
 classCount: number;
 amountRm: number;
 currency: "MYR";
 status: "pending" | "paid" | "cancelled";
 whatsappMessage: string;
 createdAt: Date;
 paidAt?: Date;
 adminNote?: string;
 /** Linked sales ledger row when order was recorded as a sale too. */
 saleId?: ObjectId;
};

export type StudentStatus = "none" | "pending" | "verified" | "rejected";

export type ClientDb = {
 _id?: ObjectId;
 customerKey: string;
 name: string;
 email: string;
 whatsapp: string;
 /** Canonical digits (MY 0… → 60…); unique sparse index prevents dup accounts. */
 whatsappDigits?: string;
 studentStatus: StudentStatus;
 studentName?: string;
 studentAge?: number | null;
 schoolName?: string;
 studentId?: string;
 universityEndYear?: number | null;
 createdAt: Date;
 updatedAt: Date;
 lastLoginAt?: Date;
  googleSub?: string;
  appleSub?: string;
  /** scrypt-hashed 4-digit PIN for email password login */
  passwordHash?: string;
  /** App push notifications (promotions / events). Booking alerts always sent when device registered. */
  pushMarketingOptIn?: boolean;
};

export type PushTokenDb = {
 _id?: ObjectId;
 clientId: ObjectId;
 token: string;
 platform: "ios" | "android" | "web";
 createdAt: Date;
 updatedAt: Date;
};

export type DataDeletionRequestDb = {
 _id?: ObjectId;
 email: string;
 name?: string;
 whatsapp?: string;
 message?: string;
 status: "pending" | "processed" | "cancelled";
 clientId?: ObjectId;
 source: "web";
 createdAt: Date;
 updatedAt: Date;
};

export type CreditLedgerDb = {
 _id?: ObjectId;
 clientId: ObjectId;
 type:
  | "purchase_grant"
  | "admin_adjust"
  | "booking_consume"
  | "booking_cancel_refund"
  | string;
 amount: number;
 expiresAt?: Date;
 /** When true and expiresAt has passed, this grant stops counting toward balance. Explicit false = grace until studio approves expiry; omit on legacy rows (expired grants stay excluded). */
 expiryApproved?: boolean;
 orderId?: ObjectId;
 planId?: ObjectId;
 bookingId?: ObjectId;
 /** Manual sales ledger row that granted/recalled these credits */
 saleId?: ObjectId;
 note?: string;
 createdAt: Date;
};

export type PromotionDb = {
 _id?: ObjectId;
 name: string;
 description?: string;
 /** fixed/percent auto-calc; other = custom offer (manual amount / display label). */
 discountType: "fixed" | "percent" | "other";
 discountValue: number;
 /** Display text when discountType is "other" (e.g. "Buy 1 Get 1"). */
 discountLabel?: string;
 /** Badge text on plan cards; falls back to name. */
 badgeLabel?: string;
 /** Plans that show this promo badge / discounted price. */
 planIds?: ObjectId[];
 /** Promo image (https URL or data:image… for small uploads). */
 imageUrl?: string;
 /** Show as site popup modal when active + has image. */
 showAsModal?: boolean;
 /** Optional click-through for the modal image. */
 modalLink?: string;
 active: boolean;
 sortOrder: number;
 createdAt: Date;
 updatedAt: Date;
};

/** Retail shop SKUs (K-beauty / merch) — separate from class-type `items`. */
export type ShopProductDb = {
 _id?: ObjectId;
 name: string;
 priceRm: number;
 active: boolean;
 sortOrder: number;
 createdAt: Date;
 updatedAt: Date;
};

export type SaleKind = "plan" | "product";

/** Shop other income/expense (not plan/product sales). */
export type CashTxnKind = "income" | "expense";

export type CashTransactionDb = {
  _id?: ObjectId;
  kind: CashTxnKind;
  occurredAt: Date;
  amountRm: number;
  currency: "MYR";
  category: string;
  description: string;
  note?: string;
  status: "recorded" | "voided";
  voidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type SaleLineItemDb = {
 productId: ObjectId;
 productName: string;
 quantity: number;
 unitPriceRm: number;
 lineAmountRm: number;
};

export type SaleDb = {
 _id?: ObjectId;
 soldAt: Date;
 clientId?: ObjectId;
 clientName: string;
 clientEmail?: string;
 clientWhatsapp?: string;
 /** Defaults to plan for legacy rows. */
 saleKind?: SaleKind;
 itemId?: ObjectId;
 itemName?: string;
 planId?: ObjectId;
 planTitle?: string;
 productId?: ObjectId;
 productName?: string;
 quantity?: number;
 /** Multi-product lines on one receipt (product sales). */
 items?: SaleLineItemDb[];
 classCount: number;
 validityDays: number;
 promotionId?: ObjectId;
 promotionName?: string;
 listPriceRm: number;
 computedAmountRm: number;
 amountRm: number;
 amountOverridden: boolean;
 currency: "MYR";
 status: "paid" | "refunded";
 /** Printed receipt number, e.g. RCP2026-0609-002 */
 receiptNo?: string;
 /** Shown on receipt; defaults to online transfer when omitted. */
 paymentMethod?: string;
 note?: string;
 creditLedgerId?: ObjectId;
 /** Linked package order when sale was also recorded as an order. */
 orderId?: ObjectId;
 refundedAt?: Date;
 refundAmountRm?: number;
 refundNote?: string;
 refundLedgerId?: ObjectId;
 createdAt: Date;
 updatedAt: Date;
};

export type EventDb = {
 _id?: ObjectId;
 title: string;
 summary: string;
 description?: string;
 imageUrl?: string;
 startsAt?: Date;
 endsAt?: Date;
 location?: string;
 priceLabel?: string;
 capacityLabel?: string;
 whatsappText?: string;
 active: boolean;
 sortOrder: number;
 createdAt: Date;
 updatedAt: Date;
};

export type ExclusiveLockDb = {
 _id?: ObjectId;
 exclusiveKey: string;
 dateKey: string; // YYYY-MM-DD in businessTimeZone
 bucket: number; // minute bucket index (e.g., 5-min buckets)
 itemId: ObjectId; // the owning class type for this exclusiveKey/time
 createdAt: Date;
 updatedAt: Date;
};

export type ItemDoc = WithId<ItemDb>;
export type TimeSlotDoc = WithId<TimeSlotDb>;
export type BookingDoc = WithId<BookingDb>;
export type ExclusiveLockDoc = WithId<ExclusiveLockDb>;
export type SettingsHistoryDoc = WithId<SettingsHistoryDb>;

declare global {
 var _mongoClientPromise: Promise<MongoClient> | undefined;
 var _mongoIndexesEnsured: boolean | undefined;
}

const MONGODB_URI = () => requireEnv("MONGODB_URI");
const MONGODB_DB = () => optionalEnv("MONGODB_DB");

export async function getMongoClient(): Promise<MongoClient> {
 if (!global._mongoClientPromise) {
  const client = new MongoClient(MONGODB_URI());
  global._mongoClientPromise = client.connect();
 }
 return global._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
 const client = await getMongoClient();
 const dbName = MONGODB_DB();
 const db = dbName ? client.db(dbName) : client.db();
 await ensureIndexes(db);
 return db;
}

export async function getCollections(db?: Db): Promise<{
 db: Db;
 settings: Collection<SettingsDoc>;
 settingsHistory: Collection<SettingsHistoryDb>;
 items: Collection<ItemDb>;
 timeSlots: Collection<TimeSlotDb>;
 bookings: Collection<BookingDb>;
 exclusiveLocks: Collection<ExclusiveLockDb>;
 plans: Collection<PlanDb>;
 orders: Collection<OrderDb>;
 clients: Collection<ClientDb>;
 creditLedger: Collection<CreditLedgerDb>;
 events: Collection<EventDb>;
 pushTokens: Collection<PushTokenDb>;
 dataDeletionRequests: Collection<DataDeletionRequestDb>;
 promotions: Collection<PromotionDb>;
  shopProducts: Collection<ShopProductDb>;
  sales: Collection<SaleDb>;
  cashTransactions: Collection<CashTransactionDb>;
}> {
  const resolvedDb = db ?? (await getDb());
  return {
  db: resolvedDb,
  settings: resolvedDb.collection<SettingsDoc>("settings"),
  settingsHistory: resolvedDb.collection<SettingsHistoryDb>("settingsHistory"),
  items: resolvedDb.collection<ItemDb>("items"),
  timeSlots: resolvedDb.collection<TimeSlotDb>("timeSlots"),
  bookings: resolvedDb.collection<BookingDb>("bookings"),
  exclusiveLocks: resolvedDb.collection<ExclusiveLockDb>("exclusiveLocks"),
  plans: resolvedDb.collection<PlanDb>("plans"),
  orders: resolvedDb.collection<OrderDb>("orders"),
  clients: resolvedDb.collection<ClientDb>("clients"),
  creditLedger: resolvedDb.collection<CreditLedgerDb>("creditLedger"),
  events: resolvedDb.collection<EventDb>("events"),
  pushTokens: resolvedDb.collection<PushTokenDb>("pushTokens"),
  dataDeletionRequests: resolvedDb.collection<DataDeletionRequestDb>(
   "dataDeletionRequests",
  ),
  promotions: resolvedDb.collection<PromotionDb>("promotions"),
  shopProducts: resolvedDb.collection<ShopProductDb>("shopProducts"),
  sales: resolvedDb.collection<SaleDb>("sales"),
  cashTransactions: resolvedDb.collection<CashTransactionDb>("cashTransactions"),
 };
}

async function ensureIndexes(db: Db): Promise<void> {
 if (global._mongoIndexesEnsured) return;

 const timeSlots = db.collection<TimeSlotDb>("timeSlots");
 const bookings = db.collection<BookingDb>("bookings");
 const items = db.collection<ItemDb>("items");
 const exclusiveLocks = db.collection<ExclusiveLockDb>("exclusiveLocks");
 const settingsHistory = db.collection<SettingsHistoryDb>("settingsHistory");
 const clients = db.collection<ClientDb>("clients");
 const plans = db.collection<PlanDb>("plans");
 const orders = db.collection<OrderDb>("orders");
 const creditLedger = db.collection<CreditLedgerDb>("creditLedger");
 const eventsColl = db.collection<EventDb>("events");
 const pushTokens = db.collection<PushTokenDb>("pushTokens");
 const dataDeletionRequests = db.collection<DataDeletionRequestDb>(
  "dataDeletionRequests",
 );
 const promotions = db.collection<PromotionDb>("promotions");
  const shopProducts = db.collection<ShopProductDb>("shopProducts");
  const sales = db.collection<SaleDb>("sales");
  const cashTransactions = db.collection<CashTransactionDb>("cashTransactions");
  // const settings = db.collection<SettingsDoc>("settings"); // _id index exists by default

 try {
  // NOTE: MongoDB already has a unique _id index; attempting to specify `unique` on it errors.
  // We keep settings as a singleton by always using _id="singleton".

  // Backfill canonical WhatsApp digits before unique index.
  try {
   const { clientWhatsappFields } = await import("@/lib/whatsapp");
   const needDigits = await clients
    .find({
     whatsapp: { $exists: true, $type: "string", $ne: "" },
     $or: [
      { whatsappDigits: { $exists: false } },
      { whatsappDigits: null as unknown as string },
      { whatsappDigits: "" },
     ],
    } as Filter<ClientDb>)
    .toArray();
   for (const c of needDigits) {
    if (!c._id) continue;
    const fields = clientWhatsappFields(c.whatsapp ?? "");
    if (!fields) continue;
    await clients.updateOne(
     { _id: c._id },
     {
      $set: {
       whatsapp: fields.whatsapp,
       whatsappDigits: fields.whatsappDigits,
      },
     },
    );
   }
  } catch (e) {
   console.error("[db] whatsappDigits backfill failed", e);
  }

  // Drop legacy unique index (dateKey+startMin+endMin) if it still exists.
  // We now use dateKey+itemId+startMin+endMin so different class types can share the same times.
  try {
   const idx = await timeSlots.indexes();
   if (idx.some((i) => i.name === "uniq_date_start_end")) {
    await timeSlots.dropIndex("uniq_date_start_end");
   }
  } catch {
   // ignore
  }

  // Drop legacy unique index used for old exclusiveKey behavior (it forced capacity=1).
  try {
   const idx = await bookings.indexes();
   if (idx.some((i) => i.name === "uniq_exclusive_time_confirmed")) {
    await bookings.dropIndex("uniq_exclusive_time_confirmed");
   }
  } catch {
   // ignore
  }

  // Legacy clients.customerKey unique index used a shorter name; rename by drop + recreate below.
  try {
   const idx = await clients.indexes();
   if (idx.some((i) => i.name === "uniq_customer_key")) {
    await clients.dropIndex("uniq_customer_key");
   }
  } catch {
   // ignore
  }

  await Promise.all([
   timeSlots.createIndex(
    { dateKey: 1, itemId: 1, startMin: 1, endMin: 1 },
    { unique: true, name: "uniq_date_item_start_end" }
   ),
   timeSlots.createIndex(
    { itemId: 1, dateKey: 1, cancelled: 1 },
    { name: "item_date_cancelled" }
   ),
   bookings.createIndex({ slotId: 1, status: 1 }, { name: "slot_status" }),
   bookings.createIndex({ createdAt: -1 }, { name: "createdAt_desc" }),
   bookings.createIndex({ dateKey: 1, startMin: 1 }, { name: "date_start" }),
   bookings.createIndex({ itemId: 1, dateKey: 1 }, { name: "item_date" }),
   bookings.createIndex({ code: 1 }, { unique: true, name: "uniq_code" }),
   bookings.createIndex(
    { dateKey: 1, status: 1, reminderSentAt: 1 },
    { name: "date_status_reminder" }
   ),
   exclusiveLocks.createIndex(
    { exclusiveKey: 1, dateKey: 1, bucket: 1 },
    { unique: true, name: "uniq_exclusive_lock_bucket" }
   ),
   exclusiveLocks.createIndex(
    { exclusiveKey: 1, dateKey: 1, itemId: 1 },
    { name: "exclusive_key_date_item" }
   ),
   items.createIndex({ active: 1 }, { name: "active" }),
   items.createIndex({ name: 1 }, { name: "name" }),
   settingsHistory.createIndex(
    { settingsId: 1, createdAt: -1 },
    { name: "settings_id_createdAt" }
   ),
   clients.createIndex({ email: 1 }, { unique: true, name: "uniq_client_email" }),
   clients.createIndex({ customerKey: 1 }, { unique: true, name: "uniq_client_customerKey" }),
   clients.createIndex(
    { whatsappDigits: 1 },
    { unique: true, sparse: true, name: "uniq_client_whatsappDigits" },
   ),
   clients.createIndex({ appleSub: 1 }, { unique: true, sparse: true, name: "uniq_client_appleSub" }),
   plans.createIndex({ code: 1 }, { unique: true, name: "uniq_plan_code" }),
   orders.createIndex({ orderRef: 1 }, { unique: true, name: "uniq_order_ref" }),
   orders.createIndex({ clientId: 1 }, { name: "order_client" }),
   creditLedger.createIndex({ clientId: 1 }, { name: "ledger_clientId" }),
   creditLedger.createIndex({ bookingId: 1 }, { sparse: true, name: "ledger_bookingId" }),
   bookings.createIndex({ clientId: 1 }, { sparse: true, name: "booking_clientId" }),
   eventsColl.createIndex({ active: 1, sortOrder: 1, startsAt: 1 }, { name: "events_active_sort" }),
   pushTokens.createIndex({ token: 1 }, { unique: true, name: "uniq_push_token" }),
   pushTokens.createIndex({ clientId: 1 }, { name: "push_clientId" }),
   dataDeletionRequests.createIndex(
    { email: 1, createdAt: -1 },
    { name: "deletion_email_createdAt" },
   ),
   dataDeletionRequests.createIndex({ status: 1 }, { name: "deletion_status" }),
   promotions.createIndex({ active: 1, sortOrder: 1 }, { name: "promo_active_sort" }),
   shopProducts.createIndex(
    { active: 1, sortOrder: 1, name: 1 },
    { name: "shop_products_active_sort" },
   ),
   sales.createIndex({ soldAt: -1 }, { name: "sales_soldAt_desc" }),
   sales.createIndex({ status: 1, soldAt: -1 }, { name: "sales_status_soldAt" }),
   sales.createIndex({ clientId: 1 }, { sparse: true, name: "sales_clientId" }),
   cashTransactions.createIndex(
    { occurredAt: -1 },
    { name: "cash_occurredAt_desc" },
   ),
   cashTransactions.createIndex(
    { status: 1, occurredAt: -1 },
    { name: "cash_status_occurredAt" },
   ),
   cashTransactions.createIndex(
    { kind: 1, occurredAt: -1 },
    { name: "cash_kind_occurredAt" },
   ),
   creditLedger.createIndex({ saleId: 1 }, { sparse: true, name: "ledger_saleId" }),
   creditLedger.createIndex(
    { expiresAt: 1 },
    { sparse: true, name: "ledger_expiresAt" },
   ),
  ]);

  // One-time: merge +60… / 60… / 0… WhatsApp duplicate client accounts.
  try {
   const settings = db.collection<SettingsDoc>("settings");
   const singleton = await settings.findOne({ _id: "singleton" });
   if (!singleton?.whatsappDedupeV2Done) {
    const { dedupeClientsByWhatsapp } = await import("@/lib/clientMerge");
    await dedupeClientsByWhatsapp({
     clients,
     creditLedger,
     orders,
     bookings,
    });
    await settings.updateOne(
     { _id: "singleton" },
     {
      $set: {
       whatsappDedupeV1Done: true,
       whatsappDedupeV2Done: true,
       updatedAt: new Date(),
      },
     },
     { upsert: true },
    );
   }
  } catch (e) {
   console.error("[db] whatsapp dedupe migration failed", e);
  }

  global._mongoIndexesEnsured = true;
 } catch (e) {
  throw e;
 }
}
