import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../_utils/http";

export async function GET() {
  try {
    const { items } = await getCollections();
    const docs = await items
      .find({ active: true })
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(200)
      .toArray();
    return jsonOk({
      items: docs.map((it) => ({
        id: it._id!.toHexString(),
        name: it.name,
        description: it.description,
        capacity: it.capacity,
        color: it.color ?? "",
      })),
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

