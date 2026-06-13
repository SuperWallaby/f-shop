import {
 MongoClient,
 type Db,
 type Collection,
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
 | "reformer_private"
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
 listPriceRm?: number;
 validityDays: number;
 active: boolean;
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
 classCount: number;
 amountRm: number;
 currency: "MYR";
 status: "pending" | "paid" | "cancelled";
 whatsappMessage: string;
 createdAt: Date;
 paidAt?: Date;
 adminNote?: string;
};

export type StudentStatus = "none" | "pending" | "verified" | "rejected";

export type ClientDb = {
 _id?: ObjectId;
 customerKey: string;
 name: string;
 email: string;
 whatsapp: string;
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
 note?: string;
 createdAt: Date;
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
 // const settings = db.collection<SettingsDoc>("settings"); // _id index exists by default

 try {
  // NOTE: MongoDB already has a unique _id index; attempting to specify `unique` on it errors.
  // We keep settings as a singleton by always using _id="singleton".

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
   clients.createIndex({ appleSub: 1 }, { unique: true, sparse: true, name: "uniq_client_appleSub" }),
   plans.createIndex({ code: 1 }, { unique: true, name: "uniq_plan_code" }),
   orders.createIndex({ orderRef: 1 }, { unique: true, name: "uniq_order_ref" }),
   orders.createIndex({ clientId: 1 }, { name: "order_client" }),
   creditLedger.createIndex({ clientId: 1 }, { name: "ledger_clientId" }),
   creditLedger.createIndex({ bookingId: 1 }, { sparse: true, name: "ledger_bookingId" }),
   bookings.createIndex({ clientId: 1 }, { sparse: true, name: "booking_clientId" }),
   eventsColl.createIndex({ active: 1, sortOrder: 1, startsAt: 1 }, { name: "events_active_sort" }),
  ]);

  global._mongoIndexesEnsured = true;
 } catch (e) {
  throw e;
 }
}
