import { NextRequest } from "next/server";
import { ObjectId, type UpdateFilter } from "mongodb";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../../_utils/http";
import { requireAdmin } from "../../../_utils/adminAuth";
import { adminUpdateSlotSchema } from "@/lib/schemas";
import type { TimeSlotDb } from "@/lib/db";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { sendClassCancelledByInstructorEmail } from "@/lib/email";
import {
  sendAdminWhatsAppNotification,
  sendClassCancelledByInstructorWhatsApp,
} from "@/lib/twilioWhatsApp";
import { releaseExclusiveLocksAfterBookingRemoved } from "@/lib/exclusiveLocks";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const { id } = await ctx.params;
    const slotObjectId = ObjectId.isValid(id) ? new ObjectId(id) : null;
    if (!slotObjectId) return jsonError("Invalid slot id", 400);

    const body = await req.json().catch(() => null);
    const parsed = adminUpdateSlotSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const { timeSlots, bookings, items, exclusiveLocks } = await getCollections();
    const now = new Date();

    const existing = await timeSlots.findOne({ _id: slotObjectId });
    if (!existing) return jsonError("Slot not found", 404);

    const set: Partial<
      Pick<TimeSlotDb, "itemId" | "startMin" | "endMin" | "cancelled" | "updatedAt">
    > = { updatedAt: now };
    if (parsed.data.itemId !== undefined) {
      const itemObjectId = ObjectId.isValid(parsed.data.itemId)
        ? new ObjectId(parsed.data.itemId)
        : null;
      if (!itemObjectId) return jsonError("Invalid itemId", 400);
      set.itemId = itemObjectId;
    }
    if (parsed.data.startMin !== undefined) set.startMin = parsed.data.startMin;
    if (parsed.data.endMin !== undefined) set.endMin = parsed.data.endMin;
    if (parsed.data.cancelled !== undefined) set.cancelled = parsed.data.cancelled;

    const update: UpdateFilter<TimeSlotDb> = { $set: set };

    const result = await timeSlots.updateOne({ _id: slotObjectId }, update);
    if (!result.matchedCount) return jsonError("Slot not found", 404);

    // If this PATCH cancels a session, cancel all attached bookings + notify customers.
    if (existing.cancelled === false && parsed.data.cancelled === true) {
      // Cancel all confirmed bookings attached to this slot.
      const bs = await bookings
        .find({ slotId: slotObjectId, status: "confirmed" })
        .toArray();

      if (bs.length > 0) {
        const ids = bs.map((b) => b._id);
        await bookings.updateMany(
          { _id: { $in: ids }, status: "confirmed" },
          { $set: { status: "cancelled", cancelledAt: now } }
        );
        // Keep counts consistent with cancelled session UI
        await timeSlots.updateOne(
          { _id: slotObjectId },
          { $set: { bookedCount: 0, updatedAt: now } }
        );

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

        const effectiveItemId = set.itemId ?? existing.itemId;
        const item = effectiveItemId ? await items.findOne({ _id: effectiveItemId }) : null;
        const classTypeName = item?.name ?? "Pilates";

        // Notify customers (best-effort)
        await Promise.all(
          bs.flatMap((b) => {
            const tz = (b.businessTimeZone ?? "").trim() || BUSINESS_TIME_ZONE;
            const tasks: Array<Promise<unknown>> = [];
            tasks.push(
              sendClassCancelledByInstructorEmail({
                to: b.email,
                classTypeName,
                dateKey: b.dateKey,
                startMin: b.startMin,
                endMin: b.endMin,
                businessTimeZone: tz,
              }).catch(() => {})
            );
            const to = (b.whatsapp ?? "").trim();
            if (to) {
              tasks.push(
                sendClassCancelledByInstructorWhatsApp({
                  to,
                  classTypeName,
                  dateKey: b.dateKey,
                  startMin: b.startMin,
                  endMin: b.endMin,
                  businessTimeZone: tz,
                }).catch(() => {})
              );
            }
            return tasks;
          })
        );

        // Admin WhatsApp summary (best-effort)
        await sendAdminWhatsAppNotification({
          kind: "class_cancelled_by_instructor",
          classTypeName,
          dateKey: existing.dateKey,
          startMin: existing.startMin,
          endMin: existing.endMin,
          businessTimeZone: BUSINESS_TIME_ZONE,
          extra: `Bookings cancelled: ${bs.length}`,
        }).catch(() => {});
      }
    }

    return jsonOk({ updated: true });
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null ? (e as { code?: number }).code : undefined;
    if (code === 11000) {
      return jsonError("Slot time conflicts with an existing slot", 409);
    }
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

