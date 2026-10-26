import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { ensureDefaultPlans } from "@/lib/credits";
import { jsonError, jsonOk } from "@/app/api/_utils/http";
import { getClientIdFromRequest } from "@/app/api/_utils/clientAuth";
import { planDocToPublicDto } from "@/lib/planDto";
import {
  findEligiblePromotionForPlanId,
  loadPromotionContext,
} from "@/lib/promotionEligibility";

export async function GET(req: NextRequest) {
  try {
    const { plans, promotions, bookings, clients } = await getCollections();
    await ensureDefaultPlans(plans);
    const [docs, { promos, attended }] = await Promise.all([
      plans
        .find({ active: true, hidden: { $ne: true } })
        .sort({ sortOrder: 1 })
        .toArray(),
      loadPromotionContext({
        promotions,
        bookings,
        clients,
        clientId: getClientIdFromRequest(req),
      }),
    ]);
    return jsonOk({
      plans: docs.map((plan) =>
        planDocToPublicDto(
          plan,
          findEligiblePromotionForPlanId(
            plan._id!.toHexString(),
            promos,
            attended,
          ),
        ),
      ),
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
