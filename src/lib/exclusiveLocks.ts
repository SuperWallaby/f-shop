import { ObjectId } from "mongodb";
import type { Collection } from "mongodb";
import type { BookingDb, ExclusiveLockDb } from "@/lib/db";

export const EXCLUSIVE_BUCKET_MINUTES = 5;

export function bucketsForRange(
  startMin: number,
  endMin: number,
  bucketMinutes = EXCLUSIVE_BUCKET_MINUTES
): number[] {
  if (!(endMin > startMin)) return [];
  const first = Math.floor(startMin / bucketMinutes);
  const last = Math.floor((endMin - 1) / bucketMinutes); // end is exclusive
  const out: number[] = [];
  for (let b = first; b <= last; b++) out.push(b);
  return out;
}

export async function acquireExclusiveLocks(args: {
  exclusiveLocks: Collection<ExclusiveLockDb>;
  exclusiveKey: string;
  dateKey: string;
  itemId: ObjectId;
  startMin: number;
  endMin: number;
  now: Date;
}): Promise<
  | { ok: true; insertedBuckets: number[] }
  | { ok: false; reason: "conflict"; ownerItemId: string }
> {
  const { exclusiveLocks, exclusiveKey, dateKey, itemId, startMin, endMin, now } =
    args;
  const key = (exclusiveKey ?? "").trim();
  if (!key) return { ok: true, insertedBuckets: [] };

  const buckets = bucketsForRange(startMin, endMin);
  if (buckets.length === 0) return { ok: true, insertedBuckets: [] };

  const insertedBuckets: number[] = [];
  try {
    for (const bucket of buckets) {
      try {
        const r = await exclusiveLocks.updateOne(
          { exclusiveKey: key, dateKey, bucket, itemId },
          {
            $set: { updatedAt: now },
            $setOnInsert: { exclusiveKey: key, dateKey, bucket, itemId, createdAt: now },
          },
          { upsert: true }
        );
        if (r.upsertedId) insertedBuckets.push(bucket);
      } catch (e) {
        // Unique collision: bucket is owned by another itemId.
        if (e && typeof e === "object" && "code" in e && (e as { code?: number }).code === 11000) {
          const existing = await exclusiveLocks.findOne(
            { exclusiveKey: key, dateKey, bucket },
            { projection: { itemId: 1 } }
          );
          const owner = existing?.itemId?.toHexString?.() ?? "";
          // rollback only buckets we inserted in this attempt
          if (insertedBuckets.length > 0) {
            await exclusiveLocks.deleteMany({
              exclusiveKey: key,
              dateKey,
              itemId,
              bucket: { $in: insertedBuckets },
            });
          }
          return { ok: false, reason: "conflict", ownerItemId: owner };
        }
        throw e;
      }
    }
    return { ok: true, insertedBuckets };
  } catch (e) {
    // best-effort rollback
    if (insertedBuckets.length > 0) {
      await exclusiveLocks.deleteMany({
        exclusiveKey: key,
        dateKey,
        itemId,
        bucket: { $in: insertedBuckets },
      });
    }
    throw e;
  }
}

export async function releaseExclusiveLocksAfterBookingRemoved(args: {
  exclusiveLocks: Collection<ExclusiveLockDb>;
  bookings: Collection<BookingDb>;
  exclusiveKey: string;
  dateKey: string;
  itemId: ObjectId;
  startMin: number;
  endMin: number;
}): Promise<void> {
  const { exclusiveLocks, bookings, exclusiveKey, dateKey, itemId, startMin, endMin } =
    args;
  const key = (exclusiveKey ?? "").trim();
  if (!key) return;

  const buckets = bucketsForRange(startMin, endMin);
  if (buckets.length === 0) return;

  const remaining = await bookings
    .find(
      { status: "confirmed", exclusiveKey: key, dateKey, itemId },
      { projection: { startMin: 1, endMin: 1 } }
    )
    .limit(5000)
    .toArray();

  const covered = new Set<number>();
  for (const b of remaining) {
    for (const buck of bucketsForRange(b.startMin, b.endMin)) covered.add(buck);
  }

  const toDelete = buckets.filter((b) => !covered.has(b));
  if (toDelete.length === 0) return;

  await exclusiveLocks.deleteMany({
    exclusiveKey: key,
    dateKey,
    itemId,
    bucket: { $in: toDelete },
  });
}

