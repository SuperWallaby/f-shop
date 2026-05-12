"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicPlanDto } from "@/lib/planDto";

type Options = { enabled?: boolean };

export function usePlanPurchase(options: Options = {}) {
  const enabled = options.enabled !== false;
  const [plans, setPlans] = useState<PublicPlanDto[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [planOrderLoading, setPlanOrderLoading] = useState<string | null>(null);
  const [planOrderMessage, setPlanOrderMessage] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setPlans([]);
      setPlansLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setPlansLoading(true);
      try {
        const res = await fetch("/api/public/plans", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? "Failed to load plans");
        if (!cancelled) setPlans((json.data.plans ?? []) as PublicPlanDto[]);
      } catch {
        if (!cancelled) setPlans([]);
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const payForPlan = useCallback(async (planId: string) => {
    setPlanOrderLoading(planId);
    setPlanOrderMessage(null);
    setOrderError(null);
    try {
      const res = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? "Order failed");
      const url = json.data.order.whatsappUrl as string;
      setPlanOrderMessage(
        `Order ${json.data.order.orderRef} created. Send the WhatsApp payment request, then admin will apply credits.`,
      );
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setOrderError(e instanceof Error ? e.message : "Order failed");
    } finally {
      setPlanOrderLoading(null);
    }
  }, []);

  return {
    plans,
    plansLoading,
    planOrderLoading,
    planOrderMessage,
    orderError,
    setOrderError,
    payForPlan,
  };
}
