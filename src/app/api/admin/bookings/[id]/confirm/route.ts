import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../../../_utils/http";
import { requireAdmin } from "../../../../_utils/adminAuth";
import { notifyBookingConfirmed } from "@/lib/bookingConfirmedNotify";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const { id } = await ctx.params;
    const bookingId = ObjectId.isValid(id) ? new ObjectId(id) : null;
    if (!bookingId) return jsonError("Invalid booking id", 400);

    const { bookings, items } = await getCollections();
    const booking = await bookings.findOne({ _id: bookingId });
    if (!booking) return jsonError("Booking not found", 404);
    if (booking.status === "confirmed") {
      return jsonOk({ confirmed: true, status: "confirmed" });
    }
    if (booking.status !== "pending") {
      return jsonError("Only pending bookings can be confirmed", 409);
    }

    const now = new Date();
    const updated = await bookings.updateOne(
      { _id: bookingId, status: "pending" },
      { $set: { status: "confirmed", confirmedAt: now } },
    );
    if (!updated.modifiedCount) {
      return jsonError("Booking status changed. Refresh and try again.", 409);
    }

    const item = await items.findOne(
      { _id: booking.itemId },
      { projection: { name: 1 } },
    );
    await notifyBookingConfirmed({
      booking,
      classTypeName: item?.name ?? "Pilates",
      adminNote: "Confirmed by admin after WhatsApp conversation",
    });

    return jsonOk({ confirmed: true, status: "confirmed" });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
