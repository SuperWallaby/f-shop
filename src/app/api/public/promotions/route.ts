import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "@/app/api/_utils/http";
import { getClientIdFromRequest } from "@/app/api/_utils/clientAuth";
import {
  formatPromotionDiscountText,
  promotionBadgeLabel,
} from "@/lib/promotionMath";
import {
  isPromotionUnlocked,
  loadPromotionContext,
} from "@/lib/promotionEligibility";

/** Public active promotions (modal + plan badge metadata). */
export async function GET(req: NextRequest) {
  try {
    const { promotions, bookings, clients } = await getCollections();
    const { promos, attended } = await loadPromotionContext({
      promotions,
      bookings,
      clients,
      clientId: getClientIdFromRequest(req),
    });
    const docs = promos
      .filter((p) => isPromotionUnlocked(p, attended))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

    return jsonOk({
      promotions: docs.map((doc) => ({
        id: doc._id?.toHexString() ?? "",
        name: doc.name,
        description: doc.description ?? "",
        discountType: doc.discountType,
        discountValue: doc.discountValue,
        discountLabel: doc.discountLabel ?? "",
        badgeLabel: promotionBadgeLabel(doc),
        discountText: formatPromotionDiscountText(doc),
        planIds: (doc.planIds ?? []).map((id) => id.toHexString()),
        imageUrl: doc.imageUrl ?? "",
        showAsModal: Boolean(doc.showAsModal) && Boolean(doc.imageUrl),
        modalLink: doc.modalLink ?? "",
        sortOrder: doc.sortOrder,
      })),
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
