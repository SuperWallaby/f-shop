import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../../../_utils/http";
import { requireAdmin } from "../../../../_utils/adminAuth";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const { id } = await ctx.params;
    const slotObjectId = ObjectId.isValid(id) ? new ObjectId(id) : null;
    if (!slotObjectId) return jsonError("Invalid slot id", 400);

    const { timeSlots, bookings } = await getCollections();
    const now = new Date();

    const slot = await timeSlots.findOne({ _id: slotObjectId });
    if (!slot) return jsonError("Slot not found", 404);

    if (!slot.cancelled) {
      return jsonError("Only cancelled slots can be deleted", 409);
    }

    const deleteRes = await timeSlots.deleteOne({ _id: slotObjectId });
    if (!deleteRes.deletedCount) return jsonError("Slot not found", 404);

    const detachRes = await bookings.updateMany(
      { slotId: slotObjectId, detached: { $ne: true } },
      {
        $set: {
          slotId: null,
          detached: true,
          detachedAt: now,
          detachedFromSlotId: slotObjectId,
        },
      }
    );

    return jsonOk({ deleted: true, detachedBookings: detachRes.modifiedCount ?? 0 });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

