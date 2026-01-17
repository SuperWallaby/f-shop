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

declare global {
 // eslint-disable-next-line no-var
 var _mongoClientPromise: Promise<MongoClient> | undefined;
 // eslint-disable-next-line no-var
 var _mongoIndexesEnsured: boolean | undefined;
}

const MONGODB_URI = () => requireEnv("MONGODB_URI");
const MONGODB_DB = () => optionalEnv("MONGODB_DB");

async function getMongoClient(): Promise<MongoClient> {
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
 items: Collection<ItemDb>;
 timeSlots: Collection<TimeSlotDb>;
 bookings: Collection<BookingDb>;
 exclusiveLocks: Collection<ExclusiveLockDb>;
}> {
 const resolvedDb = db ?? (await getDb());
 return {
  db: resolvedDb,
  settings: resolvedDb.collection<SettingsDoc>("settings"),
  items: resolvedDb.collection<ItemDb>("items"),
  timeSlots: resolvedDb.collection<TimeSlotDb>("timeSlots"),
  bookings: resolvedDb.collection<BookingDb>("bookings"),
  exclusiveLocks: resolvedDb.collection<ExclusiveLockDb>("exclusiveLocks"),
 };
}

async function ensureIndexes(db: Db): Promise<void> {
 if (global._mongoIndexesEnsured) return;

 const timeSlots = db.collection<TimeSlotDb>("timeSlots");
 const bookings = db.collection<BookingDb>("bookings");
 const items = db.collection<ItemDb>("items");
 const exclusiveLocks = db.collection<ExclusiveLockDb>("exclusiveLocks");
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
  ]);

  global._mongoIndexesEnsured = true;
 } catch (e) {
  throw e;
 }
}
