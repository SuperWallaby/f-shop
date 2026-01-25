import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../_utils/http";
import { requireAdmin } from "../../_utils/adminAuth";
import { dateKeySchema } from "@/lib/schemas";
import { minutesToUtcIso } from "@/lib/time";
import type { DateKey } from "@/lib/time";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const dateKey = dateKeySchema.parse(req.nextUrl.searchParams.get("dateKey"));
    const typedDateKey = dateKey as DateKey;
    const { timeSlots, bookings, items } = await getCollections();
    const tz = BUSINESS_TIME_ZONE;

    const slotDocs = await timeSlots
      .find({ dateKey })
      .sort({ startMin: 1 })
      .toArray();

    const itemIds = Array.from(
      new Set(slotDocs.map((s) => s.itemId?.toHexString()).filter(Boolean) as string[])
    );
    const itemDocs = itemIds.length
      ? await items
          .find({ _id: { $in: itemIds.map((id) => new ObjectId(id)) } })
          .toArray()
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

    const bookingDocs = await bookings.find({ dateKey }).toArray();

    const exclusiveBookingsByKey = new Map<
      string,
      Array<{ itemId: string; startMin: number; endMin: number }>
    >();
    for (const b of bookingDocs) {
      if (b.status !== "confirmed") continue;
      const k = (b.exclusiveKey ?? "").trim();
      if (!k) continue;
      const list = exclusiveBookingsByKey.get(k) ?? [];
      list.push({
        itemId: b.itemId?.toHexString?.() ?? "",
        startMin: b.startMin,
        endMin: b.endMin,
      });
      exclusiveBookingsByKey.set(k, list);
    }

    const bookingsBySlotId = new Map<string, typeof bookingDocs>();
    for (const b of bookingDocs) {
      if (!b.slotId) continue; // detached bookings
      const key = b.slotId.toHexString();
      const list = bookingsBySlotId.get(key) ?? [];
      list.push(b);
      bookingsBySlotId.set(key, list);
    }

    const slots = slotDocs.map((s) => {
      const slotId = s._id.toHexString();
      const itemId = s.itemId?.toHexString?.() ?? "";
      const item = itemsById.get(itemId);
      const exKey = (item?.exclusiveKey ?? "").trim();
      const cap = item?.capacity ?? 0;
      const slotBookings = bookingsBySlotId.get(slotId) ?? [];
      const bookedCount = s.bookedCount;
      const isBlockedByExclusive =
        !!exKey &&
        (exclusiveBookingsByKey.get(exKey) ?? []).some(
          (b) =>
            b.itemId !== itemId && b.startMin < s.endMin && b.endMin > s.startMin
        );
      const available = isBlockedByExclusive ? 0 : Math.max(0, cap - bookedCount);
      return {
        id: slotId,
        itemId,
        itemName: item?.name ?? "(missing item)",
        itemColor: item?.color ?? "",
        dateKey: s.dateKey,
        startMin: s.startMin,
        endMin: s.endMin,
        capacity: cap,
        bookedCount,
        available,
        cancelled: s.cancelled,
        notes: item?.name ?? "",
        startUtc: minutesToUtcIso(typedDateKey, s.startMin, tz),
        endUtc: minutesToUtcIso(typedDateKey, s.endMin, tz),
        bookings: slotBookings.map((b) => ({
          id: b._id.toHexString(),
          code: b.code ?? "",
          name: b.name,
          email: b.email,
          whatsapp: b.whatsapp ?? "",
          status: b.status,
          starred: Boolean((b as unknown as { starred?: boolean }).starred),
          createdAt: b.createdAt,
          cancelledAt: b.cancelledAt ?? null,
        })),
      };
    });

    return jsonOk({ dateKey, timeZone: tz, slots });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

