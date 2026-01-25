import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../../_utils/http";
import { requireAdmin } from "../../../_utils/adminAuth";
import { ObjectId, type Filter } from "mongodb";
import type { BookingDb } from "@/lib/db";

function parseBool(v: string | null): boolean | null {
  if (v === null) return null;
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
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

    const { bookings, items: itemCol } = await getCollections();

    const and: Filter<BookingDb>[] = [];
    if (q.length > 0) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const or: Filter<BookingDb>[] = [{ name: re }, { email: re }, { whatsapp: re }];
      // booking code search (allow '#123456' or '123456')
      if (/^\d{6}$/.test(q)) or.push({ code: q });
      and.push({ $or: or });
    }
    if (dateKey.length > 0) {
      and.push({ dateKey });
    }
    if (detached !== null) {
      if (detached) and.push({ detached: true, slotId: null });
      else and.push({ $or: [{ detached: { $ne: true } }, { slotId: { $ne: null } }] });
    }
    if (starred !== null) {
      if (starred) and.push({ starred: true });
      else and.push({ $or: [{ starred: { $ne: true } }, { starred: { $exists: false } }] });
    }

    const filter: Filter<BookingDb> = and.length ? ({ $and: and } as Filter<BookingDb>) : {};

    const docs = await bookings
      .find(filter)
      .sort({ dateKey: 1, startMin: 1, createdAt: 1 })
      .limit(200)
      .toArray();

    const itemIds = Array.from(
      new Set(docs.map((b) => b.itemId?.toHexString()).filter(Boolean) as string[])
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

    const items = docs.map((b) => ({
      id: b._id!.toHexString(),
      code: b.code ?? "",
      name: b.name,
      email: b.email,
      whatsapp: b.whatsapp ?? "",
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

    return jsonOk({ items });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

