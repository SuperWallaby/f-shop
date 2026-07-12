import type { ObjectId } from "mongodb";
import type { PlanDb, PromotionDb } from "@/lib/db";
import { resolveFirstTimerPriceRm } from "@/lib/credits";
import {
  applyPromotionDiscount,
  formatPromotionDiscountText,
  promotionBadgeLabel,
} from "@/lib/promotionMath";

export type PublicPlanDto = {
  id: string;
  code: string;
  title: string;
  cardTitle: string | null;
  category: PlanDb["category"];
  sortOrder: number;
  classCount: number;
  priceRm: number;
  studentPriceRm: number | null;
  firstTimerPriceRm: number | null;
  listPriceRm: number | null;
  validityDays: number;
  detailLines: string[];
  priceNote: string | null;
  promotionActive: boolean;
  promotionDiscount: string | null;
  promotionLabel: string | null;
  /** Discounted regular price when a fixed/percent promo targets this plan. */
  promoPriceRm: number | null;
  /** Discounted student price when applicable. */
  promoStudentPriceRm: number | null;
};

/** Label inside a category group on booking / homepage cards; falls back to full title. */
export function planDisplayTitle(
  plan: Pick<PublicPlanDto, "title" | "cardTitle">,
): string {
  const c = (plan.cardTitle ?? "").trim();
  return c.length > 0 ? c : plan.title;
}

/** Stable unique key derived from a plan title (e.g. "Group Mat - 4 Classes" → "group-mat-4-classes"). */
export function slugifyPlanCode(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return base || "plan";
}

export function planDocToPublicDto(
  plan: PlanDb & { _id: ObjectId },
  promo?: (PromotionDb & { _id?: ObjectId }) | null,
): PublicPlanDto {
  const base: PublicPlanDto = {
    id: plan._id.toHexString(),
    code: plan.code,
    title: plan.title,
    cardTitle: plan.cardTitle ?? null,
    category: plan.category,
    sortOrder: plan.sortOrder,
    classCount: plan.classCount,
    priceRm: plan.priceRm,
    studentPriceRm:
      typeof plan.studentPriceRm === "number" ? plan.studentPriceRm : null,
    firstTimerPriceRm: resolveFirstTimerPriceRm(plan),
    listPriceRm: typeof plan.listPriceRm === "number" ? plan.listPriceRm : null,
    validityDays: plan.validityDays,
    detailLines: plan.detailLines ?? [],
    priceNote: plan.priceNote ?? null,
    promotionActive: Boolean(plan.promotionActive),
    promotionDiscount: plan.promotionDiscount ?? null,
    promotionLabel: plan.promotionLabel ?? null,
    promoPriceRm: null,
    promoStudentPriceRm: null,
  };

  if (!promo?.active) return base;

  const isNumeric =
    promo.discountType === "fixed" || promo.discountType === "percent";
  return {
    ...base,
    promotionActive: true,
    promotionLabel: promotionBadgeLabel(promo),
    promotionDiscount: formatPromotionDiscountText(promo),
    promoPriceRm: isNumeric
      ? applyPromotionDiscount(plan.priceRm, promo)
      : null,
    promoStudentPriceRm:
      isNumeric && typeof plan.studentPriceRm === "number"
        ? applyPromotionDiscount(plan.studentPriceRm, promo)
        : null,
  };
}
