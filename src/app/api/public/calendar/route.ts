import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../_utils/http";
import { calendarRangeQuerySchema } from "@/lib/schemas";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { ObjectId } from "mongodb";

export async function GET(req: NextRequest) {
  try {
    const parsed = calendarRangeQuerySchema.safeParse({
      fromDateKey: req.nextUrl.searchParams.get("fromDateKey"),
      toDateKey: req.nextUrl.searchParams.get("toDateKey"),
    });
    if (!parsed.success) {
      return jsonError("Invalid query", 400, parsed.error.flatten());
    }

    const { fromDateKey, toDateKey } = parsed.data;
    const { timeSlots, bookings, items } = await getCollections();

    const slotDocs = await timeSlots
      .find({ dateKey: { $gte: fromDateKey, $lte: toDateKey }, cancelled: false })
      .sort({ dateKey: 1, startMin: 1 })
      .toArray();

    const itemIds = Array.from(
      new Set(slotDocs.map((s) => s.itemId?.toHexString()).filter(Boolean) as string[])
    );
    const itemDocs = itemIds.length
      ? await items.find({ _id: { $in: itemIds.map((id) => new ObjectId(id)) } }).toArray()
      : [];
    const itemsById = new Map<
      string,
      { name: string; capacity: number; exclusiveKey?: string; color?: string }
    >();
    for (const it of itemDocs) {
      itemsById.set(it._id!.toHexString(), {
        name: it.name,
        capacity: it.capacity,
        exclusiveKey: it.exclusiveKey ?? "",
        color: it.color ?? "",
      });
    }

    const bookingDocs = await bookings
      .find({ dateKey: { $gte: fromDateKey, $lte: toDateKey }, status: "confirmed" })
      .toArray();

    const exclusiveBookingsByGroup = new Map<
      string,
      Array<{ itemId: string; startMin: number; endMin: number }>
    >();
    for (const b of bookingDocs) {
      const k = (b.exclusiveKey ?? "").trim();
      if (!k) continue;
      const gk = `${k}|${b.dateKey}`;
      const list = exclusiveBookingsByGroup.get(gk) ?? [];
      list.push({
        itemId: b.itemId?.toHexString?.() ?? "",
        startMin: b.startMin,
        endMin: b.endMin,
      });
      exclusiveBookingsByGroup.set(gk, list);
    }

    const bookingsBySlot = new Map<string, typeof bookingDocs>();
    for (const b of bookingDocs) {
      if (!b.slotId) continue; // detached bookings should not appear in public calendar
      const key = b.slotId.toHexString();
      const list = bookingsBySlot.get(key) ?? [];
      list.push(b);
      bookingsBySlot.set(key, list);
    }

    const daysMap = new Map<
      string,
      {
        dateKey: string;
        slots: Array<{
          id: string;
          itemId: string;
          itemName: string;
          itemColor: string;
          startMin: number;
          endMin: number;
          capacity: number;
          bookedCount: number;
          notes: string;
          bookingNames: string[];
        }>;
      }
    >();

    for (const s of slotDocs) {
      const ensured =
        daysMap.get(s.dateKey) ??
        ({
          dateKey: s.dateKey,
          slots: [],
        } as (typeof daysMap extends Map<string, infer V> ? V : never));
      const slotId = s._id.toHexString();
      const itemId = s.itemId?.toHexString?.() ?? "";
      const item = itemsById.get(itemId);
      const bs = bookingsBySlot.get(slotId) ?? [];
      const exKey = (item?.exclusiveKey ?? "").trim();
      const isBlockedByExclusive =
        !!exKey &&
        (exclusiveBookingsByGroup.get(`${exKey}|${s.dateKey}`) ?? []).some(
          (b) =>
            b.itemId !== itemId && b.startMin < s.endMin && b.endMin > s.startMin
        );
      if (isBlockedByExclusive) continue;
      ensured.slots.push({
        id: slotId,
        itemId,
        itemName: item?.name ?? "(missing item)",
        itemColor: item?.color ?? "",
        startMin: s.startMin,
        endMin: s.endMin,
        capacity: item?.capacity ?? 0,
        bookedCount: s.bookedCount,
        notes: item?.name ?? "",
        bookingNames: bs.map((b) => b.name),
      });
      daysMap.set(s.dateKey, ensured);
    }

    const days = Array.from(daysMap.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    return jsonOk({ fromDateKey, toDateKey, timeZone: BUSINESS_TIME_ZONE, days });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

