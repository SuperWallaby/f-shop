import { NextRequest } from "next/server";
import { DateTime } from "luxon";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../../_utils/http";
import { requireAdmin } from "../../../_utils/adminAuth";
import { optionalEnv } from "@/lib/env";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { sendBookingReminderEmail } from "@/lib/email";
import {
  sendAdminWhatsAppNotification,
  sendBookingReminderWhatsApp,
} from "@/lib/twilioWhatsApp";

function allowJob(req: NextRequest) {
  if (req.headers.get("x-vercel-cron") === "1") return null;
  const auth = requireAdmin(req);
  if (!auth) return null;
  const secret = optionalEnv("REMINDER_JOB_SECRET");
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
    const tz = BUSINESS_TIME_ZONE;
    const now = new Date();

    const dateKey =
      req.nextUrl.searchParams.get("dateKey") ||
      DateTime.now().setZone(tz).plus({ days: 1 }).toISODate()!;

    const { bookings } = await getCollections();

    const docs = await bookings
      .find(
        {
          status: "confirmed",
          dateKey,
          reminderSentAt: { $exists: false },
        },
        {
          projection: {
            _id: 1,
            name: 1,
            email: 1,
            whatsapp: 1,
            itemId: 1,
            dateKey: 1,
            startMin: 1,
            endMin: 1,
            businessTimeZone: 1,
          },
        }
      )
      .limit(5000)
      .toArray();

    let considered = docs.length;
    let sentOrMarked = 0;

    for (const b of docs) {
      const bTz = (b.businessTimeZone ?? "").trim() || tz;

      let okAny = false;
      try {
        await sendBookingReminderEmail({
          to: b.email,
          dateKey: b.dateKey,
          startMin: b.startMin,
          endMin: b.endMin,
          businessTimeZone: bTz,
        });
        okAny = true;
      } catch {
        // ignore
      }

      try {
        const to = (b.whatsapp ?? "").trim();
        if (to) {
          await sendBookingReminderWhatsApp({
            to,
            dateKey: b.dateKey,
            startMin: b.startMin,
            endMin: b.endMin,
            businessTimeZone: bTz,
          });
          okAny = true;
        }
      } catch {
        // ignore
      }

      if (!okAny) continue;

      const updated = await bookings.updateOne(
        { _id: b._id, reminderSentAt: { $exists: false } },
        { $set: { reminderSentAt: now } }
      );
      if (updated.modifiedCount) sentOrMarked++;
    }

    await sendAdminWhatsAppNotification({
      kind: "reminder_sent",
      extra: `Sent reminders: ${sentOrMarked}/${considered} for ${dateKey}`,
    }).catch(() => {});

    return jsonOk({ dateKey, timeZone: tz, considered, sentOrMarked });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

