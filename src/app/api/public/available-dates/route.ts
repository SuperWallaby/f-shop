import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../_utils/http";
import { publicAvailableDatesQuerySchema } from "@/lib/schemas";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { getBookingRulesFromSettings, isSlotBookableByRules } from "@/lib/bookingRules";
import { DateTime } from "luxon";
import { ObjectId } from "mongodb";

export async function GET(req: NextRequest) {
  try {
    const parsed = publicAvailableDatesQuerySchema.safeParse({
      fromDateKey: req.nextUrl.searchParams.get("fromDateKey"),
      toDateKey: req.nextUrl.searchParams.get("toDateKey"),
      itemId: req.nextUrl.searchParams.get("itemId"),
    });
    if (!parsed.success) {
      return jsonError("Invalid query", 400, parsed.error.flatten());
    }

    const { fromDateKey, toDateKey, itemId } = parsed.data;
    const { settings, timeSlots, items, bookings } = await getCollections();
    const itemObjectId =
      itemId && ObjectId.isValid(itemId) ? new ObjectId(itemId) : null;

    const activeItems = itemObjectId
      ? await items.find({ _id: itemObjectId, active: true }).toArray()
      : await items.find({ active: true }).toArray();

    if (itemObjectId && activeItems.length === 0)
      return jsonError("Item not found", 404);
    if (activeItems.length === 0)
      return jsonOk({ fromDateKey, toDateKey, itemId: null, dateKeys: [] });

    const itemById = new Map(
      activeItems.map((it) => [it._id.toHexString(), it])
    );
    const activeItemIds = activeItems.map((it) => it._id);

    const settingsDoc = await settings.findOne({ _id: "singleton" });
    const rules = getBookingRulesFromSettings(settingsDoc);
    const now = new Date();
    const latestAllowedDateKey = DateTime.fromJSDate(now)
      .setZone(BUSINESS_TIME_ZONE)
      .plus({ days: rules.maxDaysAhead })
      .toISODate()!;

    const slotDocs = await timeSlots
      .find(
        {
          dateKey: { $gte: fromDateKey, $lte: toDateKey },
          cancelled: false,
          itemId: { $in: activeItemIds },
        },
        {
          projection: {
            _id: 0,
            dateKey: 1,
            startMin: 1,
            endMin: 1,
            itemId: 1,
            bookedCount: 1,
          },
        }
      )
      .toArray();

    const exclusiveKeys = Array.from(
      new Set(
        activeItems
          .map((it) => (it.exclusiveKey ?? "").trim())
          .filter((x) => x.length > 0)
      )
    );
    const exclusiveBookingsByGroup = new Map<
      string,
      Array<{ itemId: string; startMin: number; endMin: number }>
    >();
    if (exclusiveKeys.length > 0) {
      const bs = await bookings
        .find(
          {
            dateKey: { $gte: fromDateKey, $lte: toDateKey },
            status: "confirmed",
            exclusiveKey: { $in: exclusiveKeys },
          },
          {
            projection: {
              _id: 0,
              exclusiveKey: 1,
              dateKey: 1,
              itemId: 1,
              startMin: 1,
              endMin: 1,
            },
          }
        )
        .toArray();
      for (const b of bs) {
        const k = (b.exclusiveKey ?? "").trim();
        if (!k) continue;
        const groupKey = `${k}|${b.dateKey}`;
        const list = exclusiveBookingsByGroup.get(groupKey) ?? [];
        list.push({
          itemId: b.itemId?.toHexString?.() ?? "",
          startMin: b.startMin,
          endMin: b.endMin,
        });
        exclusiveBookingsByGroup.set(groupKey, list);
      }
    }

    const dateKeysSet = new Set<string>();
    for (const s of slotDocs) {
      const it = itemById.get(s.itemId.toHexString());
      if (!it) continue;
      const exKey = (it.exclusiveKey ?? "").trim();
      const cap = it.capacity;
      const bookedCount = s.bookedCount;
      const isBlockedByExclusive =
        !!exKey &&
        (exclusiveBookingsByGroup.get(`${exKey}|${s.dateKey}`) ?? []).some(
          (b) =>
            b.itemId !== it._id?.toHexString?.() &&
            b.startMin < s.endMin &&
            b.endMin > s.startMin
        );
      if (bookedCount >= cap) continue;
      if (isBlockedByExclusive) continue;
      if (s.dateKey > latestAllowedDateKey) continue;
      if (
        isSlotBookableByRules({
          now,
          dateKey: s.dateKey,
          startMin: s.startMin,
          rules,
        })
      ) {
        dateKeysSet.add(s.dateKey);
      }
    }

    const dateKeys = Array.from(dateKeysSet.values()).sort();

    return jsonOk({
      fromDateKey,
      toDateKey,
      itemId: itemObjectId ? itemObjectId.toHexString() : null,
      dateKeys,
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

