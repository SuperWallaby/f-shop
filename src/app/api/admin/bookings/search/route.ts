import { NextRequest } from "next/server";
import { DateTime } from "luxon";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../../_utils/http";
import { requireAdmin } from "../../../_utils/adminAuth";
import { ObjectId, type Filter, type WithId } from "mongodb";
import type { BookingDb } from "@/lib/db";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

function parseBool(v: string | null): boolean | null {
  if (v === null) return null;
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

function parseSortMode(v: string | null): "latest_booking" | "closest_class" {
  return v === "closest_class" ? "closest_class" : "latest_booking";
}

function parseLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? String(DEFAULT_LIMIT), 10);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(n, 1), MAX_LIMIT);
}

function parseLatestCursor(cursor: string): { createdAt: Date; id: ObjectId } | null {
  const i = cursor.lastIndexOf("|");
  if (i < 0) return null;
  const createdAt = new Date(cursor.slice(0, i));
  const id = cursor.slice(i + 1);
  if (!ObjectId.isValid(id) || !Number.isFinite(createdAt.getTime())) return null;
  return { createdAt, id: new ObjectId(id) };
}

function parseClosestCursor(
  cursor: string
): { dateKey: string; startMin: number; createdAt: Date; id: ObjectId } | null {
  const parts = cursor.split("|");
  if (parts.length !== 4) return null;
  const [dateKey, startMinStr, createdAtStr, id] = parts;
  const startMin = Number(startMinStr);
  const createdAt = new Date(createdAtStr);
  if (!ObjectId.isValid(id) || !Number.isFinite(startMin) || !Number.isFinite(createdAt.getTime())) {
    return null;
  }
  return { dateKey, startMin, createdAt, id: new ObjectId(id) };
}

function latestCursorFromDoc(doc: WithId<BookingDb>): string {
  return `${doc.createdAt.toISOString()}|${doc._id.toHexString()}`;
}

function closestCursorFromDoc(doc: WithId<BookingDb>): string {
  return `${doc.dateKey}|${doc.startMin}|${doc.createdAt.toISOString()}|${doc._id.toHexString()}`;
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const qRaw = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const q = qRaw.replace(/^#/, "").trim();
    const dateKey = (req.nextUrl.searchParams.get("dateKey") ?? "").trim();
    const detached = parseBool(req.nextUrl.searchParams.get("detached"));
    const starred = parseBool(req.nextUrl.searchParams.get("starred"));
    const todayOnly = parseBool(req.nextUrl.searchParams.get("todayOnly"));
    const sortMode = parseSortMode(req.nextUrl.searchParams.get("sort"));
    const cursorRaw = (req.nextUrl.searchParams.get("cursor") ?? "").trim();
    const limit = parseLimit(req.nextUrl.searchParams.get("limit"));

    const todayDateKey =
      DateTime.now().setZone(BUSINESS_TIME_ZONE).toISODate() ?? "";

    const { bookings, items: itemCol } = await getCollections();

    const and: Filter<BookingDb>[] = [];
    if (q.length > 0) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const or: Filter<BookingDb>[] = [{ name: re }, { email: re }, { whatsapp: re }];
      if (/^\d{6}$/.test(q)) or.push({ code: q });
      and.push({ $or: or });
    }
    if (dateKey.length > 0) {
      and.push({ dateKey });
    }
    if (todayOnly === true && todayDateKey) {
      and.push({ dateKey: todayDateKey });
    } else if (sortMode === "closest_class" && dateKey.length === 0 && todayDateKey) {
      and.push({ dateKey: { $gte: todayDateKey } });
    }
    if (detached !== null) {
      if (detached) and.push({ detached: true, slotId: null });
      else and.push({ $or: [{ detached: { $ne: true } }, { slotId: { $ne: null } }] });
    }
    if (starred !== null) {
      if (starred) and.push({ starred: true });
      else and.push({ $or: [{ starred: { $ne: true } }, { starred: { $exists: false } }] });
    }

    if (cursorRaw.length > 0) {
      if (sortMode === "latest_booking") {
        const c = parseLatestCursor(cursorRaw);
        if (!c) return jsonError("Invalid cursor", 400);
        and.push({
          $or: [
            { createdAt: { $lt: c.createdAt } },
            { createdAt: c.createdAt, _id: { $lt: c.id } },
          ],
        });
      } else {
        const c = parseClosestCursor(cursorRaw);
        if (!c) return jsonError("Invalid cursor", 400);
        and.push({
          $or: [
            { dateKey: { $gt: c.dateKey } },
            { dateKey: c.dateKey, startMin: { $gt: c.startMin } },
            {
              dateKey: c.dateKey,
              startMin: c.startMin,
              createdAt: { $gt: c.createdAt },
            },
            {
              dateKey: c.dateKey,
              startMin: c.startMin,
              createdAt: c.createdAt,
              _id: { $gt: c.id },
            },
          ],
        });
      }
    }

    const filter: Filter<BookingDb> = and.length ? ({ $and: and } as Filter<BookingDb>) : {};

    const mongoCursor = bookings.find(filter);
    const docs =
      sortMode === "latest_booking"
        ? await mongoCursor.sort({ createdAt: -1, _id: -1 }).limit(limit + 1).toArray()
        : await mongoCursor
            .sort({ dateKey: 1, startMin: 1, createdAt: 1, _id: 1 })
            .limit(limit + 1)
            .toArray();

    const hasMore = docs.length > limit;
    const page = hasMore ? docs.slice(0, limit) : docs;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? sortMode === "latest_booking"
          ? latestCursorFromDoc(last)
          : closestCursorFromDoc(last)
        : null;

    const itemIds = Array.from(
      new Set(page.map((b) => b.itemId?.toHexString()).filter(Boolean) as string[])
    );
    const itemDocs = itemIds.length
      ? await itemCol.find({ _id: { $in: itemIds.map((id) => new ObjectId(id)) } }).toArray()
      : [];
    const itemMetaById = new Map<string, { name: string; color: string }>();
    for (const it of itemDocs) {
      itemMetaById.set(it._id!.toHexString(), {
        name: it.name,
        color: it.color ?? "",
      });
    }

    const items = page.map((b) => ({
      id: b._id!.toHexString(),
      code: b.code ?? "",
      name: b.name,
      email: b.email,
      whatsapp: b.whatsapp ?? "",
      itemId: b.itemId?.toHexString?.() ?? "",
      itemName: itemMetaById.get(b.itemId?.toHexString?.() ?? "")?.name ?? "",
      itemColor: itemMetaById.get(b.itemId?.toHexString?.() ?? "")?.color ?? "",
      adminNote: b.adminNote ?? "",
      starred: Boolean(b.starred),
      status: b.status,
      createdAt: b.createdAt,
      dateKey: b.dateKey,
      startMin: b.startMin,
      endMin: b.endMin,
      detached: Boolean(b.detached) && !b.slotId,
      slotId: b.slotId ? b.slotId.toHexString() : null,
    }));

    return jsonOk({ items, nextCursor, hasMore });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
