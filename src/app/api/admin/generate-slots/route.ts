import { NextRequest } from "next/server";
import { DateTime } from "luxon";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../_utils/http";
import { requireAdmin } from "../../_utils/adminAuth";
import { adminGenerateSlotsSchema } from "@/lib/schemas";
import { ObjectId, type AnyBulkWriteOperation } from "mongodb";
import type { TimeSlotDb } from "@/lib/db";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";

function* eachDateKeyInclusive(fromDateKey: string, toDateKey: string) {
  let cur = DateTime.fromISO(fromDateKey, { zone: "utc" });
  const end = DateTime.fromISO(toDateKey, { zone: "utc" });
  while (cur <= end) {
    yield cur.toISODate()!;
    cur = cur.plus({ days: 1 });
  }
}

function weekdayKeyForDate(dateKey: string, timeZone: string): string {
  // Luxon: weekday 1=Mon..7=Sun. We want 0=Sun..6=Sat (as strings)
  const dt = DateTime.fromISO(dateKey, { zone: timeZone });
  const weekday = dt.weekday; // 1..7
  return weekday === 7 ? "0" : String(weekday);
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const body = await req.json().catch(() => null);
    const parsed = adminGenerateSlotsSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const { fromDateKey, toDateKey, force, replaceOverlaps } = parsed.data;

    const { settings, timeSlots } = await getCollections();
    const settingsDoc = await settings.findOne({ _id: "singleton" });
    const tz = BUSINESS_TIME_ZONE;
    const pattern = (settingsDoc?.weeklyPattern ?? {}) as Record<
      string,
      Array<{ startMin: number; endMin: number; itemId: string }>
    >;

    const now = new Date();
    const ops: AnyBulkWriteOperation<TimeSlotDb>[] = [];
    const keys: Array<{
      dateKey: string;
      itemId: ObjectId;
      startMin: number;
      endMin: number;
    }> = [];

    for (const dateKey of eachDateKeyInclusive(fromDateKey, toDateKey)) {
      const weekdayKey = weekdayKeyForDate(dateKey, tz);
      const items = pattern[weekdayKey] ?? [];
      for (const item of items) {
        const itemObjectId = ObjectId.isValid(item.itemId)
          ? new ObjectId(item.itemId)
          : null;
        if (!itemObjectId) continue;
        keys.push({
          dateKey,
          itemId: itemObjectId,
          startMin: item.startMin,
          endMin: item.endMin,
        });
        ops.push({
          updateOne: {
            filter: {
              dateKey,
              itemId: itemObjectId,
              startMin: item.startMin,
              endMin: item.endMin,
            },
            update: {
              $setOnInsert: {
                dateKey,
                itemId: itemObjectId,
                startMin: item.startMin,
                endMin: item.endMin,
                bookedCount: 0,
                cancelled: false,
                createdAt: now,
                updatedAt: now,
              },
            },
            upsert: true,
          },
        });
      }
    }

    if (ops.length === 0) {
      return jsonOk({ generated: 0, upserted: 0 });
    }

    // Helpers for overlap detection (same dateKey + itemId only)
    const itemIds = Array.from(new Set(keys.map((k) => k.itemId.toHexString()))).map(
      (id) => new ObjectId(id)
    );

    const existingDocsBase = await timeSlots
      .find(
        {
          dateKey: { $gte: fromDateKey, $lte: toDateKey },
          cancelled: false,
          itemId: { $in: itemIds },
        },
        { projection: { dateKey: 1, itemId: 1, startMin: 1, endMin: 1, bookedCount: 1 } }
      )
      .toArray();

    const genByGroup = new Map<
      string,
      Array<{ startMin: number; endMin: number }>
    >();
    for (const k of keys) {
      const gk = `${k.dateKey}|${k.itemId.toHexString()}`;
      const list = genByGroup.get(gk) ?? [];
      list.push({ startMin: k.startMin, endMin: k.endMin });
      genByGroup.set(gk, list);
    }
    for (const list of genByGroup.values()) {
      list.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    }

    const exByGroup = new Map<
      string,
      Array<{
        id: string;
        startMin: number;
        endMin: number;
        bookedCount: number;
      }>
    >();
    for (const d of existingDocsBase) {
      const gk = `${d.dateKey}|${d.itemId.toHexString()}`;
      const list = exByGroup.get(gk) ?? [];
      list.push({
        id: d._id.toHexString(),
        startMin: d.startMin,
        endMin: d.endMin,
        bookedCount: Number(d.bookedCount ?? 0),
      });
      exByGroup.set(gk, list);
    }
    for (const list of exByGroup.values()) {
      list.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    }

    const MAX_OVERLAPS = 80;
    const overlaps: Array<{
      dateKey: string;
      itemId: string;
      newStartMin: number;
      newEndMin: number;
      existingSlotId: string;
      existingStartMin: number;
      existingEndMin: number;
      existingBookedCount: number;
    }> = [];

    let overlapCount = 0;
    for (const [gk, gens] of genByGroup.entries()) {
      const ex = exByGroup.get(gk);
      if (!ex || ex.length === 0) continue;
      let j = 0;
      for (const g of gens) {
        while (j < ex.length && ex[j].endMin <= g.startMin) j++;
        // Scan all overlapping existing sessions for this generated session.
        for (let k = j; k < ex.length && ex[k].startMin < g.endMin; k++) {
          const overlapsTime = ex[k].startMin < g.endMin && ex[k].endMin > g.startMin;
          if (!overlapsTime) continue;
          const exactDuplicate =
            ex[k].startMin === g.startMin && ex[k].endMin === g.endMin;
          if (exactDuplicate) continue; // duplicates are fine (upsert will match)

          overlapCount++;
          if (overlaps.length < MAX_OVERLAPS) {
            const [dateKey, itemId] = gk.split("|");
            overlaps.push({
              dateKey,
              itemId,
              newStartMin: g.startMin,
              newEndMin: g.endMin,
              existingSlotId: ex[k].id,
              existingStartMin: ex[k].startMin,
              existingEndMin: ex[k].endMin,
              existingBookedCount: ex[k].bookedCount,
            });
          }
          // If we found a real conflict for this generated session, one example is enough.
          break;
        }
      }
    }

    if (!force) {
      // Overlap warning should only consider the SAME class type (itemId).
      // We warn when any generated session overlaps an existing session for the same itemId+dateKey.
      if (overlapCount > 0) {
        return jsonError("Some sessions overlap existing sessions", 409, {
          existingCount: overlapCount,
          overlaps,
          overlapsTruncated: overlapCount > overlaps.length,
        });
      }
    }

    let deletedOverlaps = 0;
    if (force && replaceOverlaps && overlapCount > 0) {
      const ids = Array.from(new Set(overlaps.map((o) => o.existingSlotId)))
        .slice(0, 5000)
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));
      if (ids.length > 0) {
        const del = await timeSlots.deleteMany({ _id: { $in: ids } });
        deletedOverlaps = del.deletedCount ?? 0;
      }
    }

    try {
      const result = await timeSlots.bulkWrite(ops, { ordered: false });
      const added = result.upsertedCount ?? 0;
      const existing = result.matchedCount ?? 0;
      return jsonOk({
        generated: ops.length,
        added,
        existing,
        duplicatesIgnored: 0,
        deletedOverlaps,
      });
    } catch (e) {
      // If an old unique index still exists (e.g. uniq_date_start_end), bulkWrite can throw
      // duplicate key errors even when our intended uniqueness includes itemId.
      // We treat duplicates as "ignored" and return partial success.
      const err = e as unknown as {
        code?: number;
        writeErrors?: Array<unknown>;
        result?: { result?: { nUpserted?: number; nMatched?: number } };
      };
      const dupCount = Array.isArray(err.writeErrors) ? err.writeErrors.length : 0;
      if (err.code === 11000 || dupCount > 0) {
        const added = err.result?.result?.nUpserted ?? 0;
        const existing = err.result?.result?.nMatched ?? 0;
        return jsonOk({
          generated: ops.length,
          added,
          existing,
          duplicatesIgnored: dupCount,
        });
      }
      throw e;
    }
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

