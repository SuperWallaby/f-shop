import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../_utils/http";
import { publicSlotsQuerySchema } from "@/lib/schemas";
import { minutesToUtcIso } from "@/lib/time";
import { z } from "zod";
import type { DateKey } from "@/lib/time";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { getBookingRulesFromSettings, isSlotBookableByRules } from "@/lib/bookingRules";
import { ObjectId } from "mongodb";

export async function GET(req: NextRequest) {
  try {
    const parsed = publicSlotsQuerySchema.safeParse({
      dateKey: req.nextUrl.searchParams.get("dateKey"),
      itemId: req.nextUrl.searchParams.get("itemId"),
    });
    if (!parsed.success) {
      return jsonError("Invalid query", 400, parsed.error.flatten());
    }

    const { dateKey, itemId } = parsed.data;
    const { settings, timeSlots, items, bookings } = await getCollections();
    const settingsDoc = await settings.findOne({ _id: "singleton" });
    const rules = getBookingRulesFromSettings(settingsDoc);
    const now = new Date();
    const itemObjectId =
      itemId && ObjectId.isValid(itemId) ? new ObjectId(itemId) : null;

    const activeItems = itemObjectId
      ? await items.find({ _id: itemObjectId, active: true }).toArray()
      : await items.find({ active: true }).toArray();

    if (itemObjectId && activeItems.length === 0)
      return jsonError("Item not found", 404);
    if (activeItems.length === 0)
      return jsonOk({ dateKey, itemId: null, timeZone: BUSINESS_TIME_ZONE, slots: [] });

    const itemById = new Map(
      activeItems.map((it) => [it._id.toHexString(), it])
    );
    const activeItemIds = activeItems.map((it) => it._id);

    const docs = await timeSlots
      .find({ dateKey, cancelled: false, itemId: { $in: activeItemIds } })
      .sort({ startMin: 1, itemId: 1 })
      .toArray();

    const exclusiveKeys = Array.from(
      new Set(
        activeItems
          .map((it) => (it.exclusiveKey ?? "").trim())
          .filter((x) => x.length > 0)
      )
    );
    const exclusiveBookingsByKey = new Map<
      string,
      Array<{ itemId: string; startMin: number; endMin: number }>
    >();
    if (exclusiveKeys.length > 0) {
      const bs = await bookings
        .find(
          { dateKey, status: "confirmed", exclusiveKey: { $in: exclusiveKeys } },
          { projection: { _id: 0, exclusiveKey: 1, itemId: 1, startMin: 1, endMin: 1 } }
        )
        .toArray();
      for (const b of bs) {
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
    }

    const tz = BUSINESS_TIME_ZONE;
    const dateKeyForIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(dateKey);
    const typedDateKey = dateKeyForIso as DateKey;

    const data = docs
      .filter((s) =>
        isSlotBookableByRules({
          now,
          dateKey: s.dateKey,
          startMin: s.startMin,
          rules,
        })
      )
      .map((s) => {
        const it = itemById.get(s.itemId.toHexString());
        if (!it) return null;
        const exKey = (it.exclusiveKey ?? "").trim();
        const cap = it.capacity;
        const bookedCount = s.bookedCount;
        const isBlockedByExclusive =
          !!exKey &&
          (exclusiveBookingsByKey.get(exKey) ?? []).some(
            (b) =>
              b.itemId !== it._id?.toHexString?.() &&
              b.startMin < s.endMin &&
              b.endMin > s.startMin
          );
        const available = isBlockedByExclusive
          ? 0
          : Math.max(0, cap - bookedCount);
        return {
          id: s._id.toHexString(),
          itemId: it._id.toHexString(),
          itemName: it.name,
          itemColor: it.color ?? "",
          dateKey: s.dateKey,
          startMin: s.startMin,
          endMin: s.endMin,
          capacity: cap,
          bookedCount,
          available,
          isFull: isBlockedByExclusive || available <= 0,
          startUtc: minutesToUtcIso(typedDateKey, s.startMin, tz),
          endUtc: minutesToUtcIso(typedDateKey, s.endMin, tz),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return jsonOk({
      dateKey,
      itemId: itemObjectId ? itemObjectId.toHexString() : null,
      timeZone: tz,
      slots: data,
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

