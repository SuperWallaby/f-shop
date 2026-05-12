import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { eventDocToPublicDto } from "@/lib/eventDto";
import { jsonError, jsonOk } from "@/app/api/_utils/http";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return jsonError("Invalid id", 400);

  try {
    const { events } = await getCollections();
    const event = await events.findOne({ _id: new ObjectId(id), active: true });
    if (!event) return jsonError("Event not found", 404);
    return jsonOk({ event: eventDocToPublicDto(event) });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
