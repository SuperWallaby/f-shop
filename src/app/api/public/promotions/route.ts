import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "@/app/api/_utils/http";
import {
  formatPromotionDiscountText,
  promotionBadgeLabel,
} from "@/lib/promotionMath";

/** Public active promotions (modal + plan badge metadata). */
export async function GET() {
  try {
    const { promotions } = await getCollections();
    const docs = await promotions
      .find({ active: true })
      .sort({ sortOrder: 1, name: 1 })
      .toArray();

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
