import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../../_utils/http";
import { requireAdmin } from "../../../_utils/adminAuth";

const patchSchema = z.object({
  adminNote: z.string().max(2000).optional(),
  starred: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const { id } = await ctx.params;
    const bookingObjectId = ObjectId.isValid(id) ? new ObjectId(id) : null;
    if (!bookingObjectId) return jsonError("Invalid booking id", 400);

    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid body", 400, parsed.error.flatten());

    const { bookings } = await getCollections();
    const note = parsed.data.adminNote;
    const trimmed = typeof note === "string" ? note.trim() : undefined;
    const starred = parsed.data.starred;

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, ""> = {};

    if (note !== undefined) {
      if (trimmed && trimmed.length > 0) $set.adminNote = trimmed;
      else $unset.adminNote = "";
    }
    if (starred !== undefined) {
      if (starred) $set.starred = true;
      else $unset.starred = "";
    }

    if (Object.keys($set).length === 0 && Object.keys($unset).length === 0) {
      return jsonOk({ updated: true });
    }

    const update = {
      ...(Object.keys($set).length ? { $set } : {}),
      ...(Object.keys($unset).length ? { $unset } : {}),
    } as const;

    const result = await bookings.updateOne({ _id: bookingObjectId }, update);
    if (!result.matchedCount) return jsonError("Booking not found", 404);

    return jsonOk({ updated: true });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(_req);
  if (auth) return auth;

  try {
    const { id } = await ctx.params;
    const bookingObjectId = ObjectId.isValid(id) ? new ObjectId(id) : null;
    if (!bookingObjectId) return jsonError("Invalid booking id", 400);

    const { bookings } = await getCollections();
    const booking = await bookings.findOne({ _id: bookingObjectId });
    if (!booking) return jsonError("Booking not found", 404);
    if (booking.status !== "cancelled") {
      return jsonError("Only cancelled bookings can be deleted", 409);
    }

    await bookings.deleteOne({ _id: bookingObjectId });

    return jsonOk({ deleted: true });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

