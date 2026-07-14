import type { PromotionDb, SaleDb } from "@/lib/db";
import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import {
  applyPromotionDiscount,
  formatPromotionDiscountText,
  promotionBadgeLabel,
} from "@/lib/promotionMath";
import {
  resolveReceiptNo,
  STUDIO_RECEIPT,
} from "@/lib/studioReceipt";

export {
  applyPromotionDiscount,
  formatPromotionDiscountText,
  promotionBadgeLabel,
};

export function serializePromotion(
  doc: PromotionDb & { _id?: { toHexString(): string } },
) {
  return {
    id: doc._id?.toHexString() ?? "",
    name: doc.name,
    description: doc.description ?? "",
    discountType: doc.discountType,
    discountValue: doc.discountValue,
    discountLabel: doc.discountLabel ?? "",
    badgeLabel: doc.badgeLabel ?? "",
    planIds: (doc.planIds ?? []).map((id) => id.toHexString()),
    imageUrl: doc.imageUrl ?? "",
    showAsModal: Boolean(doc.showAsModal),
    modalLink: doc.modalLink ?? "",
    active: doc.active,
    sortOrder: doc.sortOrder,
    createdAt: doc.createdAt?.toISOString?.() ?? null,
    updatedAt: doc.updatedAt?.toISOString?.() ?? null,
  };
}

export function parsePlanObjectIds(ids: string[] | undefined): ObjectId[] {
  if (!ids?.length) return [];
  const out: ObjectId[] = [];
  for (const raw of ids) {
    if (ObjectId.isValid(raw)) out.push(new ObjectId(raw));
  }
  return out;
}

/** First matching active promo for a plan (lowest sortOrder wins). */
export function findPromotionForPlanId(
  planIdHex: string,
  promos: Array<PromotionDb & { _id?: ObjectId }>,
): (PromotionDb & { _id?: ObjectId }) | null {
  const matches = promos.filter((p) => {
    if (!p.active) return false;
    return (p.planIds ?? []).some((id) => id.toHexString() === planIdHex);
  });
  if (matches.length === 0) return null;
  matches.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
  return matches[0] ?? null;
}

export function serializeSale(doc: SaleDb & { _id?: ObjectId }) {
  const saleKind =
    doc.saleKind ??
    (doc.productId || doc.productName ? "product" : "plan");
  return {
    id: doc._id?.toHexString() ?? "",
    soldAt: doc.soldAt.toISOString(),
    soldAtDateKey: DateTime.fromJSDate(doc.soldAt, {
      zone: BUSINESS_TIME_ZONE,
    }).toISODate(),
    clientId: doc.clientId?.toHexString() ?? null,
    clientName: doc.clientName,
    clientEmail: doc.clientEmail ?? "",
    clientWhatsapp: doc.clientWhatsapp ?? "",
    saleKind,
    itemId: doc.itemId?.toHexString() ?? null,
    itemName: doc.itemName ?? "",
    planId: doc.planId?.toHexString() ?? null,
    planTitle: doc.planTitle ?? "",
    productId: doc.productId?.toHexString() ?? null,
    productName: doc.productName ?? "",
    quantity: doc.quantity ?? (saleKind === "product" ? 1 : null),
    classCount: doc.classCount,
    validityDays: doc.validityDays,
    promotionId: doc.promotionId?.toHexString() ?? null,
    promotionName: doc.promotionName ?? "",
    listPriceRm: doc.listPriceRm,
    computedAmountRm: doc.computedAmountRm,
    amountRm: doc.amountRm,
    amountOverridden: doc.amountOverridden,
    currency: doc.currency,
    status: doc.status,
    receiptNo: resolveReceiptNo(doc),
    paymentMethod:
      doc.paymentMethod?.trim() || STUDIO_RECEIPT.defaultPaymentMethod,
    note: doc.note ?? "",
    creditLedgerId: doc.creditLedgerId?.toHexString() ?? null,
    refundedAt: doc.refundedAt?.toISOString() ?? null,
    refundAmountRm: doc.refundAmountRm ?? null,
    refundNote: doc.refundNote ?? "",
    createdAt: doc.createdAt.toISOString(),
  };
}
