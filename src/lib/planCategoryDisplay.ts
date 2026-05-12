import type { PlanDb } from "@/lib/db";

/** Same section order as the home pricing page — keep booking/plan UI in sync. */
export const PLAN_CATEGORY_DISPLAY_ORDER: readonly PlanDb["category"][] = [
  "group_mat",
  "reformer_private",
  "duet",
  "reformer_group",
] as const;

const HEADINGS: Record<PlanDb["category"], string> = {
  group_mat: "Group Mat Class",
  reformer_private: "Reformer Private Class",
  duet: "Duet class",
  reformer_group: "Reformer Group class",
};

export function planPurchaseGroupHeading(category: PlanDb["category"]): string {
  return HEADINGS[category] ?? category;
}

/** Pastel base hex per plan category — used for light plan-card backgrounds (not DB-driven). */
const PLAN_CATEGORY_ACCENT: Record<PlanDb["category"], string> = {
  group_mat: "#f6d6d8",
  reformer_private: "#d6f2ee",
  duet: "#e1d9ff",
  reformer_group: "#dff3d6",
};

export function planCategoryAccentHex(category: PlanDb["category"]): string {
  return PLAN_CATEGORY_ACCENT[category] ?? "#e9e4d8";
}
