import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../_utils/http";
import { requireAdmin } from "../../_utils/adminAuth";
import { calendarRangeQuerySchema } from "@/lib/schemas";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { ObjectId } from "mongodb";

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;

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
      .find({ dateKey: { $gte: fromDateKey, $lte: toDateKey } })
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
      {
        name: string;
        description: string;
        capacity: number;
        active: boolean;
        exclusiveKey?: string;
        color?: string;
      }
    >();
    for (const it of itemDocs) {
      itemsById.set(it._id!.toHexString(), {
        name: it.name,
        description: it.description,
        capacity: it.capacity,
        active: it.active,
        exclusiveKey: it.exclusiveKey ?? "",
        color: it.color ?? "",
      });
    }

    const bookingDocs = await bookings
      .find({ dateKey: { $gte: fromDateKey, $lte: toDateKey } })
      .toArray();

    const exclusiveBookingsByGroup = new Map<
      string,
      Array<{ itemId: string; startMin: number; endMin: number }>
    >();
    for (const b of bookingDocs) {
      if (b.status !== "confirmed") continue;
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
      if (!b.slotId) continue; // detached bookings
      const key = b.slotId.toHexString();
      const list = bookingsBySlot.get(key) ?? [];
      list.push(b);
      bookingsBySlot.set(key, list);
    }

    type DayAgg = {
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
        cancelled: boolean;
        notes: string;
        bookings: Array<{
          id: string;
          code: string;
          name: string;
          email: string;
          whatsapp?: string;
          status: "confirmed" | "cancelled" | "no_show";
        }>;
      }>;
    };

    const daysMap = new Map<string, DayAgg>();

    for (const s of slotDocs) {
      const day: DayAgg = daysMap.get(s.dateKey) ?? { dateKey: s.dateKey, slots: [] };
      const slotId = s._id.toHexString();
      const itemId = s.itemId?.toHexString?.() ?? "";
      const item = itemsById.get(itemId);
      const cap = item?.capacity ?? 0;
      const bs = bookingsBySlot.get(slotId) ?? [];
      day.slots.push({
        id: slotId,
        itemId,
        itemName: item?.name ?? "(missing item)",
        itemColor: item?.color ?? "",
        startMin: s.startMin,
        endMin: s.endMin,
        capacity: cap,
        bookedCount: s.bookedCount,
        cancelled: s.cancelled,
        notes: item?.name ?? "",
        bookings: bs.map((b) => ({
          id: b._id!.toHexString(),
          code: b.code ?? "",
          name: b.name,
          email: b.email,
          whatsapp: b.whatsapp ?? "",
          status: b.status,
        })),
      });
      daysMap.set(s.dateKey, day);
    }

    const days = Array.from(daysMap.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    return jsonOk({ fromDateKey, toDateKey, timeZone: BUSINESS_TIME_ZONE, days });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

