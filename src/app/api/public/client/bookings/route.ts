import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { DateTime } from "luxon";
import { z } from "zod";
import { getCollections } from "@/lib/db";
import { getClientIdFromRequest } from "@/app/api/_utils/clientAuth";
import { jsonError, jsonOk } from "@/app/api/_utils/http";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { minutesToUtcIso } from "@/lib/time";
import type { DateKey } from "@/lib/time";

export async function GET(req: NextRequest) {
  try {
    const clientId = getClientIdFromRequest(req);
    if (!clientId) return jsonError("Sign in required", 401);

    const todayKey = DateTime.now()
      .setZone(BUSINESS_TIME_ZONE)
      .toFormat("yyyy-MM-dd");

    const { bookings, items } = await getCollections();
    const docs = await bookings
      .find({
        clientId,
        status: "confirmed",
        dateKey: { $gte: todayKey },
      })
      .sort({ dateKey: 1, startMin: 1 })
      .limit(20)
      .toArray();

    const itemIds = Array.from(
      new Set(
        docs.map((b) => b.itemId?.toHexString()).filter(Boolean) as string[],
      ),
    );
    const itemDocs = itemIds.length
      ? await items
          .find({ _id: { $in: itemIds.map((id) => new ObjectId(id)) } })
          .toArray()
      : [];
    const itemNameById = new Map<string, string>();
    for (const it of itemDocs) {
      itemNameById.set(it._id!.toHexString(), it.name);
    }

    const toDateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    const out = docs.map((b) => {
      const typedDateKey = toDateKey.parse(b.dateKey) as DateKey;
      const tz = b.businessTimeZone || BUSINESS_TIME_ZONE;
      return {
        code: b.code ?? "",
        status: b.status,
        dateKey: b.dateKey,
        startMin: b.startMin,
        endMin: b.endMin,
        className: itemNameById.get(b.itemId.toHexString()) ?? "",
        startUtc: minutesToUtcIso(typedDateKey, b.startMin, tz),
        endUtc: minutesToUtcIso(typedDateKey, b.endMin, tz),
      };
    });

    return jsonOk({ items: out });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
