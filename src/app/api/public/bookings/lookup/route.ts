import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../../_utils/http";
import { publicBookingLookupQuerySchema } from "@/lib/schemas";
import { minutesToUtcIso } from "@/lib/time";
import type { DateKey } from "@/lib/time";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  try {
    const parsed = publicBookingLookupQuerySchema.safeParse({
      code: req.nextUrl.searchParams.get("code"),
      name: req.nextUrl.searchParams.get("name"),
      email: req.nextUrl.searchParams.get("email"),
      whatsapp: req.nextUrl.searchParams.get("whatsapp"),
    });
    if (!parsed.success) {
      return jsonError("Invalid query", 400, parsed.error.flatten());
    }

    const { code, name, email, whatsapp } = parsed.data;

    const { bookings, items } = await getCollections();

    const filter = code
      ? { code }
      : {
          name: new RegExp(`^${escapeRegex(name!)}$`, "i"),
          $or: [
            ...(email
              ? [{ email: new RegExp(`^${escapeRegex(email)}$`, "i") }]
              : []),
            ...(whatsapp ? [{ whatsapp }] : []),
          ],
        };

    const docs = await bookings
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(code ? 1 : 10)
      .toArray();

    if (docs.length === 0) {
      return jsonOk({ items: [] });
    }

    const itemIds = Array.from(
      new Set(docs.map((b) => b.itemId?.toHexString()).filter(Boolean) as string[])
    );
    const itemDocs = itemIds.length
      ? await items.find({ _id: { $in: itemIds.map((id) => new ObjectId(id)) } }).toArray()
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

