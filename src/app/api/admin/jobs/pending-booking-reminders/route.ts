import { NextRequest } from "next/server";
import { DateTime } from "luxon";
import { getCollections } from "@/lib/db";
import { optionalEnv } from "@/lib/env";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { sendPendingBookingReminderEmail } from "@/lib/email";
import { requireAdmin } from "../../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../../_utils/http";

const DEFAULT_DELAY_MINUTES = 30;

function allowJob(req: NextRequest) {
  if (req.headers.get("x-vercel-cron") === "1") return null;
  const auth = requireAdmin(req);
  if (!auth) return null;
  const secret = optionalEnv("AUTO_CANCEL_JOB_SECRET");
  if (!secret) return auth;
  const got =
    req.headers.get("x-job-secret") ??
    req.nextUrl.searchParams.get("secret") ??
    "";
  if (got === secret) return null;
  return auth;
}

function reminderDelayMinutes(): number {
  const parsed = Number(optionalEnv("PENDING_BOOKING_REMINDER_MINUTES"));
  return Number.isFinite(parsed)
    ? Math.min(24 * 60, Math.max(5, Math.floor(parsed)))
    : DEFAULT_DELAY_MINUTES;
}

export async function POST(req: NextRequest) {
  const blocked = allowJob(req);
  if (blocked) return blocked;

  try {
    const now = new Date();
    const nowKl = DateTime.fromJSDate(now).setZone(BUSINESS_TIME_ZONE);
    const delayMinutes = reminderDelayMinutes();
    const cutoff = new Date(now.getTime() - delayMinutes * 60_000);
    const siteUrl = (
      optionalEnv("PUBLIC_SITE_URL") ?? "https://fasea.studio"
    ).replace(/\/+$/, "");
    const { bookings, items } = await getCollections();
    const docs = await bookings
      .find({
        status: "pending",
        dmOpenedAt: { $exists: false },
        pendingReminderEmailSentAt: { $exists: false },
        createdAt: { $lte: cutoff },
      })
      .sort({ createdAt: 1 })
      .limit(200)
      .toArray();

    const itemDocs = docs.length
      ? await items
          .find({ _id: { $in: docs.map((booking) => booking.itemId) } })
          .toArray()
      : [];
    const itemNames = new Map(
      itemDocs.map((item) => [item._id.toHexString(), item.name]),
    );

    let sent = 0;
    let skippedPast = 0;
    let failed = 0;
    for (const booking of docs) {
      const tz = booking.businessTimeZone || BUSINESS_TIME_ZONE;
      const start = DateTime.fromISO(booking.dateKey, { zone: tz })
        .startOf("day")
        .plus({ minutes: booking.startMin });
      if (!start.isValid || start.toMillis() <= nowKl.setZone(tz).toMillis()) {
        skippedPast++;
        continue;
      }

      const claimed = await bookings.updateOne(
        {
          _id: booking._id,
          status: "pending",
          dmOpenedAt: { $exists: false },
          pendingReminderEmailSentAt: { $exists: false },
        },
        { $set: { pendingReminderEmailSentAt: now } },
      );
      if (!claimed.modifiedCount) continue;

      try {
        await sendPendingBookingReminderEmail({
          to: booking.email,
          name: booking.name,
          classTypeName:
            itemNames.get(booking.itemId.toHexString()) ?? "Pilates",
          bookingCode: booking.code ?? "",
          dateKey: booking.dateKey,
          startMin: booking.startMin,
          endMin: booking.endMin,
          businessTimeZone: tz,
          resumeUrl: `${siteUrl}/booking?resume=${encodeURIComponent(
            booking.code ?? "",
          )}`,
        });
        sent++;
      } catch {
        failed++;
        await bookings.updateOne(
          {
            _id: booking._id,
            status: "pending",
            pendingReminderEmailSentAt: now,
          },
          { $unset: { pendingReminderEmailSentAt: "" } },
        );
      }
    }

    return jsonOk({
      delayMinutes,
      considered: docs.length,
      sent,
      failed,
      skippedPast,
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
