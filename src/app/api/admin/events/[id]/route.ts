import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { eventDocToAdminDto } from "@/lib/eventDto";
import { adminEventPatchSchema } from "@/lib/schemas";
import { requireAdmin } from "../../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../../_utils/http";

function optionalDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  return value ? new Date(value) : null;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return jsonError("Invalid id", 400);

  try {
    const body = await req.json().catch(() => null);
    const parsed = adminEventPatchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const data = parsed.data;
    if (Object.keys(data).length === 0) return jsonError("No fields to update", 400);

    const $set: Record<string, unknown> = { updatedAt: new Date() };
    const $unset: Record<string, string> = {};
    const assign = (key: string, value: unknown) => {
      if (value === undefined) return;
      if (value === null) {
        $unset[key] = "";
        return;
      }
      $set[key] = value;
    };

    assign("title", data.title);
    assign("summary", data.summary);
    assign("description", data.description);
    assign("imageUrl", data.imageUrl);
    assign("startsAt", optionalDate(data.startsAt));
    assign("endsAt", optionalDate(data.endsAt));
    assign("location", data.location);
    assign("priceLabel", data.priceLabel);
    assign("capacityLabel", data.capacityLabel);
    assign("whatsappText", data.whatsappText);
    assign("active", data.active);
    assign("sortOrder", data.sortOrder);

    const { events } = await getCollections();
    const _id = new ObjectId(id);
    const update: Record<string, unknown> = { $set };
    if (Object.keys($unset).length) update.$unset = $unset;

    const result = await events.updateOne({ _id }, update);
    if (!result.matchedCount) return jsonError("Event not found", 404);

    const event = await events.findOne({ _id });
    if (!event) return jsonError("Event not found", 404);
    return jsonOk({ event: eventDocToAdminDto(event) });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
