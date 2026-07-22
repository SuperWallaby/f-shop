import type { PromotionDb } from "@/lib/db";

export type PromoDiscountInput = Pick<
  PromotionDb,
  "discountType" | "discountValue"
> & {
  discountType: "fixed" | "percent" | "other";
  discountValue?: number;
};

/** Pure helper — safe for client + server */
export function applyPromotionDiscount(
  listPriceRm: number,
  promo: PromoDiscountInput | null | undefined,
): number {
  if (!promo) return Math.max(0, listPriceRm);
  if (promo.discountType === "other") {
    // Custom offer — do not auto-change price; sales/orders use override or list.
    return Math.max(0, listPriceRm);
  }
  if (promo.discountType === "percent") {
    const pct = Math.min(100, Math.max(0, promo.discountValue ?? 0));
    // e.g. 50% off RM 50 → 25 (not 2500)
    return Math.max(
      0,
      Math.round(listPriceRm * (100 - pct)) / 100,
    );
  }
  return Math.max(
    0,
    Math.round((listPriceRm - (promo.discountValue ?? 0)) * 100) / 100,
  );
}

export function formatPromotionDiscountText(
  promo: Pick<PromotionDb, "discountType" | "discountValue" | "discountLabel" | "name">,
): string {
  if (promo.discountType === "percent") return `${promo.discountValue}%`;
  if (promo.discountType === "fixed") return `RM ${promo.discountValue}`;
  const label = (promo.discountLabel ?? "").trim();
  return label || promo.name;
}

export function promotionBadgeLabel(
  promo: Pick<PromotionDb, "badgeLabel" | "name">,
): string {
  const badge = (promo.badgeLabel ?? "").trim();
  return badge || promo.name;
}
