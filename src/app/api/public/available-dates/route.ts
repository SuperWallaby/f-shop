import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../_utils/http";
import { publicAvailableDatesQuerySchema } from "@/lib/schemas";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { getBookingRulesFromSettings } from "@/lib/bookingRules";
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
    const { settings, timeSlots, items } = await getCollections();
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
    const latestAllowedDateKey = DateTime.now()
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
            itemId: 1,
          },
        }
      )
      .toArray();

    const dateKeysSet = new Set<string>();
    for (const s of slotDocs) {
      const it = itemById.get(s.itemId.toHexString());
      if (!it) continue;
      if (s.dateKey > latestAllowedDateKey) continue;
      dateKeysSet.add(s.dateKey);
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

