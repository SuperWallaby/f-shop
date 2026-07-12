import type { PlanDb } from "@/lib/db";

/** Same section order as the home pricing page — keep booking/plan UI in sync. */
export const PLAN_CATEGORY_DISPLAY_ORDER: readonly PlanDb["category"][] = [
  "group_mat",
  "reformer_private",
  "duet",
  "reformer_group",
  "mat_private",
  "pre_post_reformer",
] as const;

/** Merged into a single "Other Plans" section at the bottom of pricing UIs. */
export const OTHER_PLAN_CATEGORIES: readonly PlanDb["category"][] = [
  "mat_private",
  "pre_post_reformer",
] as const;

const HEADINGS: Record<PlanDb["category"], string> = {
  group_mat: "Group Mat Class",
  mat_private: "Mat Private Class",
  reformer_private: "Reformer Private Class",
  pre_post_reformer: "Pre & Post Reformer Pilates",
  duet: "Duet class",
  reformer_group: "Reformer Group class",
};

export function planPurchaseGroupHeading(category: PlanDb["category"]): string {
  return HEADINGS[category] ?? category;
}

export function isOtherPlanCategory(category: PlanDb["category"]): boolean {
  return (OTHER_PLAN_CATEGORIES as readonly string[]).includes(category);
}

/** Best-matching plan category for a booked class type name (for option sorting). */
export function matchPlanCategoryForClassName(
  className: string,
): PlanDb["category"] | null {
  const n = normalizeClassLabel(className);
  if (!n) return null;

  let best: { category: PlanDb["category"]; score: number } | null = null;
  for (const category of PLAN_CATEGORY_DISPLAY_ORDER) {
    const heading = normalizeClassLabel(HEADINGS[category]);
    if (!heading) continue;
    let score = 0;
    if (n === heading) score = 3;
    else if (n.includes(heading) || heading.includes(n)) score = 2;
    else {
      const words = heading.split(" ").filter((w) => w.length >= 3);
      if (words.length > 0 && words.every((w) => n.includes(w))) score = 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { category, score };
    }
  }
  return best?.category ?? null;
}

/** Pastel base hex per plan category — used for light plan-card backgrounds (not DB-driven). */
const PLAN_CATEGORY_ACCENT: Record<PlanDb["category"], string> = {
  group_mat: "#f6d6d8",
  mat_private: "#f3e4d8",
  reformer_private: "#d6f2ee",
  pre_post_reformer: "#e8f0e4",
  duet: "#e1d9ff",
  reformer_group: "#dff3d6",
};

export function planCategoryAccentHex(category: PlanDb["category"]): string {
  return PLAN_CATEGORY_ACCENT[category] ?? "#e9e4d8";
}

function normalizeClassLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/classes?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Pick the best-matching class type (item) for a plan — by category heading, then title prefix.
 */
export function findClassTypeIdForPlan(
  plan: { category?: PlanDb["category"] | null; title: string },
  items: Array<{ id: string; name: string; active?: boolean }>,
): string {
  const active = items.filter((i) => i.active !== false);
  if (active.length === 0) return "";

  if (plan.category && HEADINGS[plan.category]) {
    const heading = normalizeClassLabel(HEADINGS[plan.category]);
    const byHeading = active.find((i) => {
      const n = normalizeClassLabel(i.name);
      return n === heading || n.includes(heading) || heading.includes(n);
    });
    if (byHeading) return byHeading.id;
  }

  const titleCore = normalizeClassLabel(plan.title.split(" - ")[0] ?? plan.title);
  if (!titleCore) return "";

  const byTitle = active.find((i) => {
    const n = normalizeClassLabel(i.name);
    if (!n) return false;
    if (n.includes(titleCore) || titleCore.includes(n)) return true;
    const words = titleCore.split(" ").filter((w) => w.length >= 3);
    return words.length > 0 && words.every((w) => n.includes(w));
  });
  return byTitle?.id ?? "";
}

