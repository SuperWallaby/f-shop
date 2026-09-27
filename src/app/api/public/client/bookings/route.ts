import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { DateTime } from "luxon";
import { z } from "zod";
import { getCollections } from "@/lib/db";
import { requireClientReady } from "@/app/api/_utils/clientAuth";
import { jsonError, jsonOk } from "@/app/api/_utils/http";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { minutesToUtcIso } from "@/lib/time";
import type { DateKey } from "@/lib/time";
import {
  CANCEL_NOTICE_HOURS,
  lateCancelFeeRm,
} from "@/lib/cancelPolicy";

const MIN_RESCHEDULE_NOTICE_HOURS = 6;

export async function GET(req: NextRequest) {
  try {
    const { clientId, response } = await requireClientReady(req);
    if (response || !clientId) return response;

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
      const isConfirmed = b.status === "confirmed";
      const className = itemNameById.get(b.itemId.toHexString()) ?? "";
      const canCancel = isConfirmed && hoursUntil >= CANCEL_NOTICE_HOURS;
      const canReschedule = isConfirmed && hoursUntil >= MIN_RESCHEDULE_NOTICE_HOURS;
      const fee = lateCancelFeeRm(className);
      const startUtc = minutesToUtcIso(typedDateKey, b.startMin, tz);
      const endUtc = minutesToUtcIso(typedDateKey, b.endMin, tz);
      const statusBlockedReason = isConfirmed
        ? null
        : "Only confirmed bookings can be changed.";
      const cancelCutoffReason =
        isConfirmed && !canCancel
          ? `Self-cancel closes ${CANCEL_NOTICE_HOURS} hours before class. Message us on WhatsApp and pay the RM ${fee} late cancellation fee.`
          : null;
      const rescheduleCutoffReason =
        isConfirmed && !canReschedule
          ? `Rescheduling is allowed up to ${MIN_RESCHEDULE_NOTICE_HOURS} hours before the session.`
          : null;

      return {
        id: b._id?.toHexString() ?? "",
        code: b.code ?? "",
        status: b.status,
        date: b.dateKey,
        dateKey: b.dateKey,
        start: startUtc,
        startMin: b.startMin,
        end: endUtc,
        endMin: b.endMin,
        class: className,
        className,
        startUtc,
        endUtc,
        slotId: b.slotId?.toHexString() ?? null,
        itemId: b.itemId.toHexString(),
        canCancel,
        cancelBlockedReason: statusBlockedReason ?? cancelCutoffReason,
        canReschedule,
        rescheduleBlockedReason: statusBlockedReason ?? rescheduleCutoffReason,
      };
    });

    return jsonOk({ items: out, scope });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
