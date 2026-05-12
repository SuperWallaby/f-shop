import type { ObjectId } from "mongodb";
import type { PlanDb } from "@/lib/db";

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
  listPriceRm: number | null;
  validityDays: number;
  detailLines: string[];
  priceNote: string | null;
  promotionActive: boolean;
  promotionDiscount: string | null;
  promotionLabel: string | null;
};

/** Label inside a category group on booking / pricing cards; falls back to full title. */
export function planDisplayTitle(plan: Pick<PublicPlanDto, "title" | "cardTitle">): string {
  const c = (plan.cardTitle ?? "").trim();
  return c.length > 0 ? c : plan.title;
}

export function planDocToPublicDto(plan: PlanDb & { _id: ObjectId }): PublicPlanDto {
  return {
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
    listPriceRm: typeof plan.listPriceRm === "number" ? plan.listPriceRm : null,
    validityDays: plan.validityDays,
    detailLines: plan.detailLines ?? [],
    priceNote: plan.priceNote ?? null,
    promotionActive: Boolean(plan.promotionActive),
    promotionDiscount: plan.promotionDiscount ?? null,
    promotionLabel: plan.promotionLabel ?? null,
  };
}
