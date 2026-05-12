import { getCollections } from "@/lib/db";
import { ensureDefaultPlans } from "@/lib/credits";
import { jsonError, jsonOk } from "@/app/api/_utils/http";
import { planDocToPublicDto } from "@/lib/planDto";

export async function GET() {
  try {
    const { plans } = await getCollections();
    await ensureDefaultPlans(plans);
    const docs = await plans.find({ active: true }).sort({ sortOrder: 1 }).toArray();
    return jsonOk({
      plans: docs.map((plan) => planDocToPublicDto(plan)),
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
