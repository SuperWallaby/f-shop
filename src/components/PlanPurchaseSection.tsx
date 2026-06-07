"use client";

import { useMemo, type ReactNode } from "react";
import { planDisplayTitle, type PublicPlanDto } from "@/lib/planDto";
import {
  PLAN_CATEGORY_DISPLAY_ORDER,
  planPurchaseGroupHeading,
} from "@/lib/planCategoryDisplay";
import SparklesIcon from "@heroicons/react/24/outline/SparklesIcon";

type Props = {
  studentStatus?: string | null;
  plans: PublicPlanDto[];
  plansLoading: boolean;
  planOrderLoading: string | null;
  orderError?: string | null;
  onPay: (planId: string) => void;
  title?: string;
  /** Rich text ok */
  description?: ReactNode;
};

/** Short validity label for plan cards (years when a whole number of 365-day years). */
function formatPlanValidityShort(days: number): string {
  if (!Number.isFinite(days) || days < 1) return "—";
  if (days === 1) return "1 day";
  if (days % 365 === 0) {
    const y = days / 365;
    return y === 1 ? "1 year" : `${y} years`;
  }
  return `${days} days`;
}

function PlanPayCard({
  plan,
  studentStatus,
  planOrderLoading,
  onPay,
}: {
  plan: PublicPlanDto;
  studentStatus?: string | null;
  planOrderLoading: string | null;
  onPay: (planId: string) => void;
}) {
  const price =
    studentStatus === "verified" && plan.studentPriceRm != null
      ? plan.studentPriceRm
      : plan.priceRm;
  const busy = planOrderLoading === plan.id;
  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy}
      onClick={() => onPay(plan.id)}
      className="w-full rounded-3xl border border-[#E8DDD4] bg-white px-5 py-4 text-left shadow-sm transition-[box-shadow,border-color] duration-200 hover:shadow-md hover:border-[#D4C4BA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A66A4A] cursor-pointer disabled:cursor-wait disabled:brightness-[0.97]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-serif text-lg font-semibold">{planDisplayTitle(plan)}</div>
          <div className="mt-2 font-semibold text-[#A66A4A]">RM {price}</div>
        </div>
        <div
          className="shrink-0 text-xs text-[#716D64] pt-1 text-right leading-snug whitespace-nowrap"
          title={`Credits valid for ${plan.validityDays} days after purchase`}
        >
          {busy ? "Creating…" : formatPlanValidityShort(plan.validityDays)}
        </div>
      </div>
    </button>
  );
}

function StudioPlanBenefits() {
  return (
    <div className="rounded-2xl border border-[#E8DDD4] bg-[#FAF8F6]/80 px-5 py-4 mb-6">
      <div className="flex items-center gap-1.5 text-xs font-medium text-[#716D64] tracking-wide">
        <SparklesIcon className="h-3 w-3 shrink-0 text-[#A66A4A]" aria-hidden />
        Special Discount
      </div>
      <ul className="mt-3 space-y-2 text-sm text-[#444444] list-disc pl-4">
        <li>
          <span className="font-semibold">First-time visitors</span>{" "}
          <span className="font-semibold text-[#A66A4A]">10% off</span> your first package.
        </li>
        <li>
          <span className="font-semibold">Students</span> complete student verification to unlock
          discounted package pricing on eligible plans.
        </li>
      </ul>
    </div>
  );
}

/** Lead line for plan purchase (WhatsApp payment flow). */
export function PlanPurchaseWhatsAppLead({ beforeSend }: { beforeSend: string }) {
  return (
    <p className="text-sm text-[#716D64]">
      {beforeSend}{" "}send the payment request by WhatsApp.
    </p>
  );
}

export function PlanPurchaseSection({
  studentStatus,
  plans,
  plansLoading,
  planOrderLoading,
  orderError,
  onPay,
  title = "Choose Plan",
  description = <PlanPurchaseWhatsAppLead beforeSend="Pick a package and" />,
}: Props) {
  const grouped = useMemo(() => {
    const byCat = new Map<PublicPlanDto["category"], PublicPlanDto[]>();
    for (const p of plans) {
      const list = byCat.get(p.category) ?? [];
      list.push(p);
      byCat.set(p.category, list);
    }
    for (const list of byCat.values()) {
      list.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return PLAN_CATEGORY_DISPLAY_ORDER.map((category) => ({
      category,
      plans: byCat.get(category) ?? [],
    })).filter((g) => g.plans.length > 0);
  }, [plans]);

  return (
    <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
      <h2 className="font-serif text-xl font-semibold">{title}</h2>
      <div className="mt-1">{description}</div>
      <div className="mt-5">
        <StudioPlanBenefits />
      </div>
      {orderError ? <div className="mt-3 text-sm text-red-700">{orderError}</div> : null}
      {plansLoading ? (
        <div className="mt-4 text-sm text-[#716D64]">Loading plans…</div>
      ) : (
        <div className="mt-4 space-y-8">
          {grouped.map((group) => (
            <section key={group.category} aria-labelledby={`plan-group-${group.category}`}>
              <h3
                id={`plan-group-${group.category}`}
                className="font-serif text-lg font-semibold text-[#444444] border-b border-[#E8DDD4]/90 pb-2 mb-4"
              >
                {planPurchaseGroupHeading(group.category)}
              </h3>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {group.plans.map((plan) => (
                  <PlanPayCard
                    key={plan.id}
                    plan={plan}
                    studentStatus={studentStatus}
                    planOrderLoading={planOrderLoading}
                    onPay={onPay}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
