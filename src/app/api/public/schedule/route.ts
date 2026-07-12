import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../_utils/http";
import { calendarRangeQuerySchema } from "@/lib/schemas";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const parsed = calendarRangeQuerySchema.safeParse({
      fromDateKey: req.nextUrl.searchParams.get("fromDateKey"),
      toDateKey: req.nextUrl.searchParams.get("toDateKey"),
    });
    if (!parsed.success) {
      return jsonError("Invalid query", 400, parsed.error.flatten());
    }

    const itemIdRaw = (req.nextUrl.searchParams.get("itemId") ?? "").trim();
    const itemObjectId =
      itemIdRaw && ObjectId.isValid(itemIdRaw) ? new ObjectId(itemIdRaw) : null;

    const { fromDateKey, toDateKey } = parsed.data;
    const { timeSlots, items } = await getCollections();

    const activeItems = itemObjectId
      ? await items.find({ _id: itemObjectId, active: true }).toArray()
      : await items.find({ active: true }).toArray();

    if (itemObjectId && activeItems.length === 0) {
      return jsonError("Item not found", 404);
    }

    const itemById = new Map(
      activeItems.map((it) => [it._id.toHexString(), it]),
    );
    const activeItemIds = activeItems.map((it) => it._id);

    const slotDocs = await timeSlots
      .find({
        dateKey: { $gte: fromDateKey, $lte: toDateKey },
        cancelled: false,
        itemId: { $in: activeItemIds },
      })
      .sort({ dateKey: 1, startMin: 1, itemId: 1 })
      .toArray();

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
          available: number;
        }>;
      }
    >();

    for (const s of slotDocs) {
      const itemId = s.itemId.toHexString();
      const item = itemById.get(itemId);
      if (!item) continue;

      const day = daysMap.get(s.dateKey) ?? { dateKey: s.dateKey, slots: [] };
      const cap = item.capacity;
      const bookedCount = s.bookedCount;
      day.slots.push({
        id: s._id.toHexString(),
        itemId,
        itemName: item.name,
        itemColor: item.color ?? "",
        startMin: s.startMin,
        endMin: s.endMin,
        capacity: cap,
        bookedCount,
        available: Math.max(0, cap - bookedCount),
      });
      daysMap.set(s.dateKey, day);
    }

    const days = Array.from(daysMap.values()).sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey),
    );

    return jsonOk({
      fromDateKey,
      toDateKey,
      itemId: itemObjectId ? itemObjectId.toHexString() : null,
      timeZone: BUSINESS_TIME_ZONE,
      items: activeItems.map((it) => ({
        id: it._id.toHexString(),
        name: it.name,
        color: it.color ?? "",
      })),
      days,
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
