import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { DateTime } from "luxon";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../../_utils/http";
import { requireAdmin } from "../../../_utils/adminAuth";
import { optionalEnv, requireEnv } from "@/lib/env";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { sendClassCancelledByInstructorEmail } from "@/lib/email";
import { sendClassCancelledByInstructorWhatsApp, sendTwilioWhatsApp } from "@/lib/twilioWhatsApp";
import { releaseExclusiveLocksAfterBookingRemoved } from "@/lib/exclusiveLocks";

function allowJob(req: NextRequest) {
  // Vercel Cron jobs send this header. This lets us safely use `vercel.json` crons
  // without committing secrets into the repo.
  // Ref: Vercel Cron Jobs.
  if (req.headers.get("x-vercel-cron") === "1") return null;

  const auth = requireAdmin(req);
  if (!auth) return null; // admin cookie ok
  const secret = optionalEnv("AUTO_CANCEL_JOB_SECRET");
  if (!secret) return auth;
  const got =
    req.headers.get("x-job-secret") ??
    req.nextUrl.searchParams.get("secret") ??
    "";
  if (got === secret) return null;
  return auth;
}

export async function POST(req: NextRequest) {
  const blocked = allowJob(req);
  if (blocked) return blocked;

  try {
    const nowUtc = DateTime.utc();
    const tz = BUSINESS_TIME_ZONE;

    const horizonHours = Number(req.nextUrl.searchParams.get("horizonHours") ?? 48);
    const maxHours = Number.isFinite(horizonHours) && horizonHours > 0 ? horizonHours : 48;

    const { timeSlots, bookings, items, exclusiveLocks } = await getCollections();

    // Look at near-future sessions only (keep it cheap)
    const fromDateKey = nowUtc.setZone(tz).toISODate()!;
    const toDateKey = nowUtc.setZone(tz).plus({ hours: maxHours }).toISODate()!;

    const slotDocs = await timeSlots
      .find({ cancelled: false, dateKey: { $gte: fromDateKey, $lte: toDateKey } })
      .toArray();

    const itemIds = Array.from(
      new Set(slotDocs.map((s) => s.itemId?.toHexString()).filter(Boolean) as string[])
    );
    const itemDocs = itemIds.length
      ? await items.find({ _id: { $in: itemIds.map((id) => new ObjectId(id)) } }).toArray()
      : [];
    const itemById = new Map<string, (typeof itemDocs)[number]>();
    for (const it of itemDocs) itemById.set(it._id!.toHexString(), it);

    const notifyTo = requireEnv("TWILIO_WHATSAPP_TO"); // studio/admin number

    let considered = 0;
    let autoCancelledSessions = 0;
    let cancelledBookings = 0;

    for (const s of slotDocs) {
      const itemId = s.itemId?.toHexString?.() ?? "";
      const item = itemById.get(itemId);
      if (!item) continue;

      const enabled = Boolean(item.autoCancelEnabled);
      const minBookings = item.autoCancelMinBookings ?? null;
      const cutoffHours = item.autoCancelCutoffHours ?? null;
      if (!enabled || !minBookings || !cutoffHours) continue;

      // Compute session start time in business TZ.
      const start = DateTime.fromISO(s.dateKey, { zone: tz })
        .startOf("day")
        .plus({ minutes: s.startMin });
      const cutoff = start.minus({ hours: cutoffHours });

      // Only trigger within the cutoff window, and before start.
      if (nowUtc < cutoff.toUTC()) continue;
      if (nowUtc >= start.toUTC()) continue;

      considered++;

      const confirmed = await bookings.countDocuments(
        { slotId: s._id, status: "confirmed" },
        { limit: 1000 }
      );
      if (confirmed >= minBookings) continue;

      // Cancel the session (idempotent guard).
      const updated = await timeSlots.updateOne(
        { _id: s._id, cancelled: false },
        { $set: { cancelled: true, updatedAt: new Date() } }
      );
      if (!updated.modifiedCount) continue;

      autoCancelledSessions++;

      // Cancel all confirmed bookings attached to this slot.
      const bs = await bookings
        .find({ slotId: s._id, status: "confirmed" })
        .toArray();
      if (bs.length > 0) {
        const ids = bs.map((b) => b._id);
        const r = await bookings.updateMany(
          { _id: { $in: ids }, status: "confirmed" },
          { $set: { status: "cancelled", cancelledAt: new Date() } }
        );
        cancelledBookings += r.modifiedCount;

        // Release exclusive locks (best-effort)
        await Promise.all(
          bs.map((b) => {
            const exKey = (b.exclusiveKey ?? "").trim();
            if (!exKey) return Promise.resolve();
            return releaseExclusiveLocksAfterBookingRemoved({
              exclusiveLocks,
              bookings,
              exclusiveKey: exKey,
              dateKey: b.dateKey,
              itemId: b.itemId,
              startMin: b.startMin,
              endMin: b.endMin,
            }).catch(() => {});
          })
        );

        // Notify customers + studio via email (best-effort)
        await Promise.all(
          bs.map((b) =>
            sendClassCancelledByInstructorEmail({
              to: b.email,
              classTypeName: item.name,
              dateKey: b.dateKey,
              startMin: b.startMin,
              endMin: b.endMin,
              businessTimeZone: b.businessTimeZone ?? tz,
            }).catch(() => {})
          )
        );

        // Notify customers via WhatsApp (best-effort)
        await Promise.all(
          bs.map((b) => {
            const to = (b.whatsapp ?? "").trim();
            if (!to) return Promise.resolve();
            return sendClassCancelledByInstructorWhatsApp({
              to,
              classTypeName: item.name,
              dateKey: b.dateKey,
              startMin: b.startMin,
              endMin: b.endMin,
              businessTimeZone: b.businessTimeZone ?? tz,
            }).catch(() => {});
          })
        );
      }

      // WhatsApp notify studio/admin (best-effort)
      const msg =
        `AUTO-CANCELLED SESSION\n` +
        `Class: ${item.name}\n` +
        `When: ${s.dateKey} ${start.toFormat("h:mm a")} (${tz})\n` +
        `Bookings: ${confirmed}/${minBookings}`;
      await sendTwilioWhatsApp({ to: notifyTo, body: msg }).catch(() => {});
    }

    return jsonOk({
      fromDateKey,
      toDateKey,
      timeZone: tz,
      considered,
      autoCancelledSessions,
      cancelledBookings,
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

