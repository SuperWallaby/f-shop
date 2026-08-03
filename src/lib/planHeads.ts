import type { PlanCategory } from "@/lib/db";

/** How many people pay for one package sale. Duet is priced per head × 2. */
export function planPayerHeads(
  category?: PlanCategory | string | null,
): number {
  return category === "duet" ? 2 : 1;
}

export function isDuetPlan(args: {
  category?: PlanCategory | string | null;
  title?: string | null;
}): boolean {
  if (args.category === "duet") return true;
  return (args.title ?? "").toLowerCase().includes("duet");
}
