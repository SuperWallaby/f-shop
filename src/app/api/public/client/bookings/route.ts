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

const MIN_CANCEL_NOTICE_HOURS = 6;

export async function GET(req: NextRequest) {
  try {
    const clientId = getClientIdFromRequest(req);
    if (!clientId) return jsonError("Sign in required", 401);

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") === "history" ? "history" : "upcoming";

    const now = DateTime.now().setZone(BUSINESS_TIME_ZONE);
    const todayKey = now.toFormat("yyyy-MM-dd");

    const { bookings, items, clients } = await getCollections();
    const client = await clients.findOne({ _id: clientId });
    if (!client) return jsonError("Sign in required", 401);

    const emailLower = (client.email ?? "").trim().toLowerCase();
    const ownershipFilter = {
      $or: [
        { clientId },
        ...(emailLower
          ? [{ email: new RegExp(`^${emailLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }]
          : []),
      ],
    };

    const filter =
      scope === "upcoming"
        ? {
            ...ownershipFilter,
            status: "confirmed" as const,
            dateKey: { $gte: todayKey },
          }
        : ownershipFilter;

    const docs = await bookings
      .find(filter)
      .sort(
        scope === "upcoming"
          ? { dateKey: 1, startMin: 1 }
          : { dateKey: -1, startMin: -1 },
      )
      .limit(scope === "upcoming" ? 20 : 50)
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
      const start = DateTime.fromISO(b.dateKey, { zone: tz })
        .startOf("day")
        .plus({ minutes: b.startMin });
      const hoursUntil = start.diff(now, "hours").hours;
      const canCancel =
        b.status === "confirmed" && hoursUntil >= MIN_CANCEL_NOTICE_HOURS;

      return {
        id: b._id?.toHexString() ?? "",
        code: b.code ?? "",
        status: b.status,
        dateKey: b.dateKey,
        startMin: b.startMin,
        endMin: b.endMin,
        className: itemNameById.get(b.itemId.toHexString()) ?? "",
        startUtc: minutesToUtcIso(typedDateKey, b.startMin, tz),
        endUtc: minutesToUtcIso(typedDateKey, b.endMin, tz),
        canCancel,
        cancelBlockedReason:
          b.status !== "confirmed"
            ? null
            : hoursUntil < MIN_CANCEL_NOTICE_HOURS
              ? `Cancellation is allowed up to ${MIN_CANCEL_NOTICE_HOURS} hours before the session.`
              : null,
      };
    });

    return jsonOk({ items: out, scope });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
