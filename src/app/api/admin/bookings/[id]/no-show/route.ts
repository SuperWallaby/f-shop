import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../../../_utils/http";
import { requireAdmin } from "../../../../_utils/adminAuth";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { sendNoShowEmail } from "@/lib/email";
import { sendAdminWhatsAppNotification, sendNoShowWhatsApp } from "@/lib/twilioWhatsApp";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const { id } = await ctx.params;
    const bookingObjectId = ObjectId.isValid(id) ? new ObjectId(id) : null;
    if (!bookingObjectId) return jsonError("Invalid booking id", 400);

    const { bookings, items } = await getCollections();
    const now = new Date();

    const booking = await bookings.findOne({ _id: bookingObjectId });
    if (!booking) return jsonError("Booking not found", 404);

    if (booking.status === "no_show") return jsonOk({ ok: true, status: "no_show" });
    if (booking.status !== "confirmed") {
      return jsonError("Only confirmed bookings can be marked as no-show", 409);
    }

    const updated = await bookings.updateOne(
      { _id: bookingObjectId, status: "confirmed" },
      { $set: { status: "no_show", noShowAt: now } }
    );
    if (!updated.modifiedCount) return jsonOk({ ok: true, status: booking.status });

    // Determine "first-timer" based on whether the customer has any prior bookings.
    const email = (booking.email ?? "").trim();
    const whatsapp = (booking.whatsapp ?? "").trim();
    const hasPrior = await bookings.findOne(
      {
        _id: { $ne: booking._id },
        createdAt: { $lt: booking.createdAt },
        $or: [
          ...(email ? [{ email: new RegExp(`^${escapeRegex(email)}$`, "i") }] : []),
          ...(whatsapp ? [{ whatsapp }] : []),
        ],
      },
      { projection: { _id: 1 } }
    );
    const firstTimer = !hasPrior;

    const item = await items.findOne({ _id: booking.itemId }, { projection: { name: 1 } });
    const classTypeName = item?.name ?? "Pilates";
    const tz = (booking.businessTimeZone ?? "").trim() || BUSINESS_TIME_ZONE;

    // Customer notifications (best-effort)
    await Promise.all([
      sendNoShowEmail({ to: booking.email, name: booking.name, firstTimer }).catch(() => {}),
      (booking.whatsapp
        ? sendNoShowWhatsApp({
            to: booking.whatsapp,
            classTypeName,
            dateKey: booking.dateKey,
            startMin: booking.startMin,
            endMin: booking.endMin,
            businessTimeZone: tz,
          })
        : Promise.resolve()
      ).catch(() => {}),
    ]);

    // Admin notification (best-effort)
    await sendAdminWhatsAppNotification({
      kind: "no_show_marked",
      name: booking.name,
      email: booking.email,
      whatsapp: booking.whatsapp,
      bookingCode: booking.code ?? undefined,
      classTypeName,
      dateKey: booking.dateKey,
      startMin: booking.startMin,
      endMin: booking.endMin,
      businessTimeZone: tz,
      extra: firstTimer ? "First-timer: yes" : "First-timer: no",
    }).catch(() => {});

    return jsonOk({ ok: true, status: "no_show", firstTimer });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

