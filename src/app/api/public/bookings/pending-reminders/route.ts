import { NextRequest } from "next/server";
import { z } from "zod";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { getCollections } from "@/lib/db";
import { getClientIdFromRequest } from "@/app/api/_utils/clientAuth";
import { jsonError, jsonOk } from "../../../_utils/http";
import { DateTime } from "luxon";

const bodySchema = z.object({
  codes: z.array(z.string().trim().regex(/^\d{6}$/)).max(10).default([]),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const codes = [...new Set(parsed.data.codes)];
    const clientId = getClientIdFromRequest(req);
    if (codes.length === 0 && !clientId) {
      return jsonOk({ items: [], activeStoredCodes: [] });
    }

    const owners = [
      ...(codes.length > 0 ? [{ code: { $in: codes } }] : []),
      ...(clientId ? [{ clientId }] : []),
    ];
    const now = DateTime.now().setZone(BUSINESS_TIME_ZONE);
    const todayKey = now.toISODate()!;
    const nowMin = now.hour * 60 + now.minute;
    const { bookings, items } = await getCollections();

    const docs = await bookings
      .find({
        status: "pending",
        dmOpenedAt: { $exists: false },
        $and: [
          { $or: owners },
          {
            $or: [
              { dateKey: { $gt: todayKey } },
              { dateKey: todayKey, startMin: { $gt: nowMin } },
            ],
          },
        ],
      })
      .sort({ dateKey: 1, startMin: 1 })
      .limit(10)
      .toArray();

    const itemIds = [...new Set(docs.map((doc) => doc.itemId.toHexString()))];
    const itemDocs = itemIds.length
      ? await items.find({ _id: { $in: docs.map((doc) => doc.itemId) } }).toArray()
      : [];
    const itemNames = new Map(
      itemDocs.map((item) => [item._id.toHexString(), item.name]),
    );
    const out = docs.map((booking) => ({
      code: booking.code ?? "",
      className: itemNames.get(booking.itemId.toHexString()) ?? "Pilates",
      dateKey: booking.dateKey,
      startMin: booking.startMin,
      endMin: booking.endMin,
      resumeHref: `/booking?resume=${encodeURIComponent(booking.code ?? "")}`,
    }));
    const returnedCodes = new Set(out.map((item) => item.code));

    return jsonOk({
      items: out,
      activeStoredCodes: codes.filter((code) => returnedCodes.has(code)),
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
