import { getCollections } from "@/lib/db";
import { ensureDefaultPlans } from "@/lib/credits";
import { jsonError, jsonOk } from "@/app/api/_utils/http";
import { planDocToPublicDto } from "@/lib/planDto";
import { findPromotionForPlanId } from "@/lib/sales";

export async function GET() {
  try {
    const { plans, promotions } = await getCollections();
    await ensureDefaultPlans(plans);
    const [docs, promoDocs] = await Promise.all([
      plans
        .find({ active: true, hidden: { $ne: true } })
        .sort({ sortOrder: 1 })
        .toArray(),
      promotions.find({ active: true }).sort({ sortOrder: 1 }).toArray(),
    ]);
    return jsonOk({
      plans: docs.map((plan) =>
        planDocToPublicDto(
          plan,
          findPromotionForPlanId(plan._id!.toHexString(), promoDocs),
        ),
      ),
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
