import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../_utils/http";
import { requireAdmin } from "../../_utils/adminAuth";
import { adminCreateSlotSchema } from "@/lib/schemas";
import type { TimeSlotDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const body = await req.json().catch(() => null);
    const parsed = adminCreateSlotSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const { timeSlots } = await getCollections();
    const now = new Date();

    const itemObjectId = ObjectId.isValid(parsed.data.itemId)
      ? new ObjectId(parsed.data.itemId)
      : null;
    if (!itemObjectId) return jsonError("Invalid itemId", 400);

    const doc: TimeSlotDb = {
      dateKey: parsed.data.dateKey,
      itemId: itemObjectId,
      startMin: parsed.data.startMin,
      endMin: parsed.data.endMin,
      bookedCount: 0,
      cancelled: false,
      createdAt: now,
      updatedAt: now,
    };

    const result = await timeSlots.insertOne(doc);
    return jsonOk({ slotId: result.insertedId.toHexString() });
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null ? (e as { code?: number }).code : undefined;
    if (code === 11000) {
      return jsonError("Slot already exists", 409);
    }
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

