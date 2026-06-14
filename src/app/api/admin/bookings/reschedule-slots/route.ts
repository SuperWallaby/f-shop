import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../../_utils/http";
import { requireAdmin } from "../../../_utils/adminAuth";
import { dateKeySchema } from "@/lib/schemas";
import { isSlotBlockedByExclusiveOverlap } from "@/lib/exclusiveBooking";

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const dateKey = dateKeySchema.parse(req.nextUrl.searchParams.get("dateKey"));
    const bookingIdRaw = (req.nextUrl.searchParams.get("bookingId") ?? "").trim();
    const bookingObjectId = ObjectId.isValid(bookingIdRaw)
      ? new ObjectId(bookingIdRaw)
      : null;
    if (!bookingObjectId) return jsonError("Invalid booking id", 400);

    const { bookings, timeSlots, items } = await getCollections();

    const booking = await bookings.findOne({ _id: bookingObjectId });
    if (!booking) return jsonError("Booking not found", 404);
    if (booking.status !== "confirmed") {
      return jsonError("Only confirmed bookings can be rescheduled", 409);
    }

    const item = await items.findOne({ _id: booking.itemId });
    if (!item) return jsonError("Class type not found", 404);

    const itemId = item._id!.toHexString();
    const currentSlotId = booking.slotId?.toHexString() ?? null;
    const exclusiveKey = (item.exclusiveKey ?? "").trim();

    const [slotDocs, dayBookings] = await Promise.all([
      timeSlots
        .find({ dateKey, itemId: item._id, cancelled: false })
        .sort({ startMin: 1 })
        .toArray(),
      bookings.find({ dateKey, status: "confirmed" }).toArray(),
    ]);

    const exclusiveBookingsByKey = new Map<
      string,
      Array<{ itemId: string; startMin: number; endMin: number }>
    >();
    for (const b of dayBookings) {
      if (b._id!.equals(bookingObjectId)) continue;
      const k = (b.exclusiveKey ?? "").trim();
      if (!k) continue;
      const list = exclusiveBookingsByKey.get(k) ?? [];
      list.push({
        itemId: b.itemId?.toHexString?.() ?? "",
        startMin: b.startMin,
        endMin: b.endMin,
      });
      exclusiveBookingsByKey.set(k, list);
    }

    const slots = slotDocs
      .filter((s) => s._id.toHexString() !== currentSlotId)
      .map((s) => {
        const slotId = s._id.toHexString();
        const confirmedOnSlot = dayBookings.filter(
          (b) =>
            !b._id!.equals(bookingObjectId) &&
            b.slotId?.toHexString() === slotId &&
            b.status === "confirmed"
        ).length;
        const occupied = confirmedOnSlot;
        const isBlockedByExclusive = isSlotBlockedByExclusiveOverlap({
          itemCapacity: item.capacity,
          itemId,
          exclusiveKey,
          slotStartMin: s.startMin,
          slotEndMin: s.endMin,
          otherBookings: exclusiveBookingsByKey.get(exclusiveKey) ?? [],
        });
        const available = isBlockedByExclusive
          ? 0
          : Math.max(0, item.capacity - occupied);

        return {
          id: slotId,
          itemId,
          startMin: s.startMin,
          endMin: s.endMin,
          capacity: item.capacity,
          bookedCount: occupied,
          available,
          selectable: available > 0,
          blockedByExclusive: isBlockedByExclusive,
        };
      });

    return jsonOk({
      dateKey,
      itemId,
      itemName: item.name,
      slots,
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
