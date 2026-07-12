import { getCollections } from "@/lib/db";
import { eventDocToPublicDto } from "@/lib/eventDto";
import { jsonError, jsonOk } from "@/app/api/_utils/http";

export async function GET() {
  try {
    const { events } = await getCollections();
    const docs = await events
      .find({ active: true })
      .sort({ sortOrder: 1, startsAt: 1, createdAt: -1 })
      .toArray();

    return jsonOk({ events: docs.map((event) => eventDocToPublicDto(event)) });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
