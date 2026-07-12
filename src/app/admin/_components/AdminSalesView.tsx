"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChevronDownIcon from "@heroicons/react/24/outline/ChevronDownIcon";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import type { PlanDb } from "@/lib/db";
import { applyPromotionDiscount } from "@/lib/promotionMath";
import { findClassTypeIdForPlan } from "@/lib/planCategoryDisplay";
import { cn } from "@/lib/cn";
import { Pill } from "./Pill";
import { SaleReceiptModal } from "./SaleReceipt";
import type { ReceiptSaleView } from "@/lib/studioReceipt";

type PlanOption = {
  id: string;
  title: string;
  category?: PlanDb["category"];
  classCount: number;
  priceRm: number;
  studentPriceRm?: number | null;
  firstTimerPriceRm?: number | null;
  validityDays: number;
  active: boolean;
};

type PriceMode = "regular" | "student" | "first_timer";

function planListPrice(plan: PlanOption, mode: PriceMode): number {
  if (mode === "student" && typeof plan.studentPriceRm === "number") {
    return plan.studentPriceRm;
  }
  if (mode === "first_timer" && typeof plan.firstTimerPriceRm === "number") {
    return plan.firstTimerPriceRm;
  }
  return plan.priceRm;
}

type ItemOption = { id: string; name: string; active: boolean };
type PromoOption = {
  id: string;
  name: string;
  discountType: "fixed" | "percent" | "other";
  discountValue: number;
  discountLabel?: string;
  active: boolean;
};

type ClientSuggest = {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  studentStatus: string;
};

type SaleRow = {
  id: string;
  soldAt: string;
  soldAtDateKey: string | null;
  clientName: string;
  clientEmail: string;
  clientWhatsapp: string;
  planTitle: string;
  itemName: string;
  promotionName: string;
  classCount: number;
  listPriceRm: number;
  amountRm: number;
  status: "paid" | "refunded";
  refundAmountRm: number | null;
  note: string;
  clientId: string | null;
  receiptNo: string;
  paymentMethod: string;
};

type StatsData = {
  kpis: {
    paidRevenue: number;
    refundTotal: number;
    netRevenue: number;
    paidCount: number;
    refundCount: number;
    creditsGranted: number;
  };
  daily: Array<{
    dateKey: string;
    revenue: number;
    refunds: number;
    net: number;
    sales: number;
  }>;
  byPlan: Array<{ label: string; revenue: number; count: number }>;
  byItem: Array<{ label: string; revenue: number; count: number }>;
  byPromotion: Array<{ label: string; revenue: number; count: number }>;
};

function money(n: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(n);
}

function defaultRange() {
  const now = DateTime.now().setZone(BUSINESS_TIME_ZONE);
  return {
    from: now.startOf("month").toISODate() ?? "",
    to: now.endOf("month").toISODate() ?? "",
  };
}

export function AdminSalesView() {
  const [range, setRange] = useState(defaultRange);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [promos, setPromos] = useState<PromoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [soldAt, setSoldAt] = useState(
    () => DateTime.now().setZone(BUSINESS_TIME_ZONE).toISODate() ?? "",
  );
  const [clientQuery, setClientQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ClientSuggest[]>([]);
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientSuggest | null>(
    null,
  );
  const [planId, setPlanId] = useState("");
  const [itemId, setItemId] = useState("");
  const [promotionId, setPromotionId] = useState("");
  const [priceMode, setPriceMode] = useState<PriceMode>("regular");
  const [classCount, setClassCount] = useState(0);
  const [validityDays, setValidityDays] = useState(30);
  const [listPriceRm, setListPriceRm] = useState(0);
  const [amountRm, setAmountRm] = useState(0);
  const [amountOverridden, setAmountOverridden] = useState(false);
  const [note, setNote] = useState("");

  const [refundId, setRefundId] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundNote, setRefundNote] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [receiptSale, setReceiptSale] = useState<ReceiptSaleView | null>(null);
  const clientComboRef = useRef<HTMLDivElement>(null);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === planId) ?? null,
    [plans, planId],
  );
  const selectedPromo = useMemo(
    () => promos.find((p) => p.id === promotionId) ?? null,
    [promos, promotionId],
  );

  const computedAmountRm = useMemo(
    () => applyPromotionDiscount(listPriceRm, selectedPromo),
    [listPriceRm, selectedPromo],
  );

  useEffect(() => {
    if (!amountOverridden) setAmountRm(computedAmountRm);
  }, [computedAmountRm, amountOverridden]);

  const loadMeta = useCallback(async () => {
    const [plansRes, itemsRes, promoRes] = await Promise.all([
      fetch("/api/admin/plans", { cache: "no-store" }),
      fetch("/api/admin/items", { cache: "no-store" }),
      fetch("/api/admin/promotions?active=1", { cache: "no-store" }),
    ]);
    const plansJson = await plansRes.json();
    const itemsJson = await itemsRes.json();
    const promoJson = await promoRes.json();
    if (plansJson?.ok) {
      setPlans(
        (plansJson.data.plans ?? []).map(
          (p: {
            id: string;
            title: string;
            category?: PlanDb["category"];
            classCount: number;
            priceRm: number;
            studentPriceRm?: number | null;
            firstTimerPriceRm?: number | null;
            validityDays: number;
            active: boolean;
          }) => p,
        ),
      );
    }
    if (itemsJson?.ok) {
      const list =
        itemsJson.data.items ?? itemsJson.data.adminItems ?? itemsJson.data;
      setItems(
        (Array.isArray(list) ? list : []).map(
          (it: { id: string; name: string; active?: boolean }) => ({
            id: it.id,
            name: it.name,
            active: it.active !== false,
          }),
        ),
      );
    }
    if (promoJson?.ok) setPromos(promoJson.data.promotions ?? []);
  }, []);

  const loadSalesAndStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        from: range.from,
        to: range.to,
        status: "all",
      });
      const [salesRes, statsRes] = await Promise.all([
        fetch(`/api/admin/sales?${qs}`, { cache: "no-store" }),
        fetch(
          `/api/admin/sales/stats?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
          { cache: "no-store" },
        ),
      ]);
      const salesJson = await salesRes.json();
      const statsJson = await statsRes.json();
      if (!salesRes.ok || !salesJson?.ok) {
        throw new Error(salesJson?.error?.message ?? "Failed to load sales");
      }
      if (!statsRes.ok || !statsJson?.ok) {
        throw new Error(statsJson?.error?.message ?? "Failed to load stats");
      }
      setSales(salesJson.data.sales ?? []);
      setStats(statsJson.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadSalesAndStats();
  }, [loadSalesAndStats]);

  useEffect(() => {
    if (!clientMenuOpen) return;
    // While a linked client is selected, opening the menu shows the recent list.
    // After typing (selection cleared), filter by the typed query.
    const q = selectedClient ? "" : clientQuery.trim();
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/admin/clients/suggest?q=${encodeURIComponent(q)}`,
            { cache: "no-store" },
          );
          const json = await res.json();
          if (res.ok && json?.ok) setSuggestions(json.data.clients ?? []);
        } catch {
          // ignore
        }
      })();
    }, 120);
    return () => clearTimeout(t);
  }, [clientQuery, clientMenuOpen, selectedClient]);

  useEffect(() => {
    if (!clientMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!clientComboRef.current?.contains(e.target as Node)) {
        setClientMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [clientMenuOpen]);

  function applyPlan(id: string) {
    setPlanId(id);
    if (!id) {
      setItemId("");
      return;
    }
    const plan = plans.find((p) => p.id === id);
    if (!plan) return;
    setClassCount(plan.classCount);
    setValidityDays(plan.validityDays);
    let mode = priceMode;
    if (mode === "student" && plan.studentPriceRm == null) mode = "regular";
    if (mode === "first_timer" && plan.firstTimerPriceRm == null) mode = "regular";
    if (mode !== priceMode) setPriceMode(mode);
    setListPriceRm(planListPrice(plan, mode));
    setAmountOverridden(false);
    setItemId(
      findClassTypeIdForPlan(
        { category: plan.category, title: plan.title },
        items,
      ),
    );
  }

  useEffect(() => {
    if (!selectedPlan) return;
    setListPriceRm(planListPrice(selectedPlan, priceMode));
    setAmountOverridden(false);
  }, [priceMode, selectedPlan]);

  function pickClient(c: ClientSuggest) {
    setSelectedClient(c);
    setClientQuery(c.name || c.email);
    setClientMenuOpen(false);
    setSuggestions([]);
    if (c.studentStatus === "verified") setPriceMode("student");
  }

  function clearClient() {
    setSelectedClient(null);
    setClientQuery("");
    setSuggestions([]);
    setClientMenuOpen(false);
  }

  async function submitSale() {
    const name = (selectedClient?.name || clientQuery).trim();
    if (!name) {
      setError("Client name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soldAt,
          clientId: selectedClient?.id,
          clientName: name,
          clientEmail: selectedClient?.email || undefined,
          clientWhatsapp: selectedClient?.whatsapp || undefined,
          planId: planId || undefined,
          itemId: itemId || undefined,
          promotionId: promotionId || undefined,
          classCount,
          validityDays,
          listPriceRm,
          computedAmountRm,
          amountRm,
          amountOverridden,
          note: note.trim() || undefined,
          priceMode,
          useStudentPrice: priceMode === "student",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Save failed");
      }
      clearClient();
      setPlanId("");
      setItemId("");
      setPromotionId("");
      setClassCount(0);
      setValidityDays(30);
      setListPriceRm(0);
      setAmountRm(0);
      setAmountOverridden(false);
      setNote("");
      setPriceMode("regular");
      await loadSalesAndStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmRefund() {
    if (!refundId) return;
    setRefunding(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sales/${refundId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refundAmountRm: refundAmount,
          refundNote: refundNote.trim() || undefined,
          recallCredits: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Refund failed");
      }
      setRefundId(null);
      await loadSalesAndStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refund failed");
    } finally {
      setRefunding(false);
    }
  }

  const kpis = stats?.kpis;

  return (
    <div className="space-y-6">
      <section className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-semibold">Sales dashboard</h2>
            <p className="mt-1 text-sm text-[#716D64]">
              Manual sales ledger (not linked to WhatsApp app orders).
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">From</span>
              <input
                type="date"
                value={range.from}
                onChange={(e) =>
                  setRange((r) => ({ ...r, from: e.target.value }))
                }
                className="rounded-2xl border border-[#E8DDD4] bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">To</span>
              <input
                type="date"
                value={range.to}
                onChange={(e) =>
                  setRange((r) => ({ ...r, to: e.target.value }))
                }
                className="rounded-2xl border border-[#E8DDD4] bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Net revenue",
              value: money(kpis?.netRevenue ?? 0),
              hint: "Paid − refunds",
            },
            {
              label: "Paid sales",
              value: String(kpis?.paidCount ?? 0),
              hint: money(kpis?.paidRevenue ?? 0),
            },
            {
              label: "Refunds",
              value: String(kpis?.refundCount ?? 0),
              hint: money(kpis?.refundTotal ?? 0),
            },
            {
              label: "Credits granted",
              value: String(kpis?.creditsGranted ?? 0),
              hint: "From paid sales in range",
            },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-3xl border border-[#E8DDD4] bg-white p-5 shadow-sm"
            >
              <div className="text-sm text-[#716D64]">{c.label}</div>
              <div className="mt-2 font-serif text-3xl font-semibold">
                {c.value}
              </div>
              <div className="mt-1 text-xs text-[#716D64]">{c.hint}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 h-64 w-full">
          {stats?.daily?.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD4" />
                <XAxis
                  dataKey="dateKey"
                  tickFormatter={(v) =>
                    DateTime.fromISO(String(v)).toFormat("LLL d")
                  }
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => money(Number(value ?? 0))}
                  labelFormatter={(l) => String(l)}
                />
                <Bar dataKey="net" name="Net" fill="#A66A4A" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-[#716D64]">
              {loading ? "Loading chart…" : "No sales in this range"}
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {(
            [
              ["By plan", stats?.byPlan ?? []],
              ["By class type", stats?.byItem ?? []],
              ["By promotion", stats?.byPromotion ?? []],
            ] as const
          ).map(([title, rows]) => (
            <div key={title} className="rounded-2xl border border-[#E8DDD4] p-4">
              <div className="text-sm font-medium text-[#444444] mb-2">
                {title}
              </div>
              {rows.length === 0 ? (
                <div className="text-xs text-[#716D64]">—</div>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {rows.slice(0, 6).map((r) => (
                    <li
                      key={r.label}
                      className="flex justify-between gap-2 text-[#716D64]"
                    >
                      <span className="truncate">{r.label}</span>
                      <span className="shrink-0 text-[#444444]">
                        {money(r.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
        <h2 className="font-serif text-xl font-semibold">Record a sale</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">Sale date</span>
            <input
              type="date"
              value={soldAt}
              onChange={(e) => setSoldAt(e.target.value)}
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
            />
          </label>
          <div className="grid gap-1 relative" ref={clientComboRef}>
            <span className="text-xs text-[#716D64]">Client name</span>
            <div className="relative">
              <input
                value={clientQuery}
                onChange={(e) => {
                  setClientQuery(e.target.value);
                  if (selectedClient) setSelectedClient(null);
                  setClientMenuOpen(true);
                }}
                onFocus={() => setClientMenuOpen(true)}
                className={cn(
                  "w-full rounded-2xl border border-[#E8DDD4] bg-white py-3 pl-4 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]",
                  clientQuery || selectedClient ? "pr-20" : "pr-11",
                )}
                placeholder="Select or type a name"
                autoComplete="off"
                role="combobox"
                aria-expanded={clientMenuOpen}
                aria-controls="sale-client-listbox"
                aria-autocomplete="list"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">
                {clientQuery || selectedClient ? (
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Clear client"
                    onClick={clearClient}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[#716D64] hover:bg-[#FAF8F6] hover:text-[#444444] cursor-pointer"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Toggle client list"
                  onClick={() => setClientMenuOpen((o) => !o)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#716D64] hover:bg-[#FAF8F6] hover:text-[#444444] cursor-pointer"
                >
                  <ChevronDownIcon
                    className={cn(
                      "h-4 w-4 transition-transform",
                      clientMenuOpen && "rotate-180",
                    )}
                  />
                </button>
              </div>
            </div>
            {clientMenuOpen ? (
              <ul
                id="sale-client-listbox"
                role="listbox"
                className="absolute z-20 top-full mt-1 left-0 right-0 rounded-2xl border border-[#E8DDD4] bg-white shadow-lg max-h-56 overflow-auto"
              >
                {suggestions.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-[#716D64]">
                    {clientQuery.trim()
                      ? "No match — keep typing to use this name"
                      : "No clients yet — type a name"}
                  </li>
                ) : (
                  suggestions.map((c) => (
                    <li
                      key={c.id}
                      role="option"
                      aria-selected={selectedClient?.id === c.id}
                    >
                      <button
                        type="button"
                        onClick={() => pickClient(c)}
                        className={cn(
                          "w-full text-left px-4 py-2.5 text-sm hover:bg-[#FAF8F6] cursor-pointer",
                          selectedClient?.id === c.id && "bg-[#DFD1C9]/50",
                        )}
                      >
                        <div className="font-medium">{c.name || "—"}</div>
                        <div className="text-xs text-[#716D64]">
                          {[c.email, c.whatsapp].filter(Boolean).join(" · ")}
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
          <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">Plan / package</span>
            <select
              value={planId}
              onChange={(e) => applyPlan(e.target.value)}
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
            >
              <option value="">—</option>
              {plans
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} · {p.classCount} cr · RM {p.priceRm}
                  </option>
                ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">Class type</span>
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
            >
              <option value="">—</option>
              {items
                .filter((it) => it.active)
                .map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">Promotion</span>
            <select
              value={promotionId}
              onChange={(e) => {
                setPromotionId(e.target.value);
                setAmountOverridden(false);
              }}
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
            >
              <option value="">None</option>
              {promos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (
                  {p.discountType === "percent"
                    ? `${p.discountValue}%`
                    : p.discountType === "fixed"
                      ? `RM ${p.discountValue}`
                      : p.discountLabel || "custom"}
                  )
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">Price</span>
            <select
              value={priceMode}
              onChange={(e) => setPriceMode(e.target.value as PriceMode)}
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
            >
              <option value="regular">
                Regular
                {selectedPlan ? ` · RM ${selectedPlan.priceRm}` : ""}
              </option>
              <option
                value="student"
                disabled={selectedPlan?.studentPriceRm == null}
              >
                Student
                {selectedPlan?.studentPriceRm != null
                  ? ` · RM ${selectedPlan.studentPriceRm}`
                  : " · n/a"}
              </option>
              <option
                value="first_timer"
                disabled={selectedPlan?.firstTimerPriceRm == null}
              >
                First-time visitor
                {selectedPlan?.firstTimerPriceRm != null
                  ? ` · RM ${selectedPlan.firstTimerPriceRm}`
                  : " · n/a"}
              </option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">Credits</span>
            <input
              type="number"
              min={0}
              value={classCount}
              onChange={(e) => setClassCount(Number(e.target.value) || 0)}
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">Validity (days)</span>
            <input
              type="number"
              min={1}
              value={validityDays}
              onChange={(e) => setValidityDays(Number(e.target.value) || 30)}
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">List price (RM)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={listPriceRm}
              onChange={(e) => {
                setListPriceRm(Number(e.target.value) || 0);
                setAmountOverridden(false);
              }}
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">
              Amount (RM)
              {amountOverridden ? (
                <span className="ml-1 text-[#A66A4A]">manual override</span>
              ) : (
                <span className="ml-1">auto {money(computedAmountRm)}</span>
              )}
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amountRm}
              onChange={(e) => {
                setAmountRm(Number(e.target.value) || 0);
                setAmountOverridden(true);
              }}
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
            />
          </label>
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-xs text-[#716D64]">Note</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
            />
          </label>
        </div>
        {error ? <div className="mt-3 text-sm text-red-700">{error}</div> : null}
        <button
          type="button"
          disabled={saving}
          onClick={() => void submitSale()}
          className="mt-4 rounded-full bg-[#DFD1C9] px-6 py-3 text-sm font-medium hover:brightness-95 disabled:opacity-50 cursor-pointer"
        >
          {saving ? "Saving…" : "Save sale"}
        </button>
      </section>

      <section className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm overflow-x-auto">
        <h2 className="font-serif text-xl font-semibold mb-4">Sales in range</h2>
        {loading ? (
          <div className="text-sm text-[#716D64]">Loading…</div>
        ) : sales.length === 0 ? (
          <div className="text-sm text-[#716D64]">No sales yet.</div>
        ) : (
          <table className="w-full text-sm text-left min-w-[720px]">
            <thead>
              <tr className="text-xs text-[#716D64] border-b border-[#E8DDD4]">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Client</th>
                <th className="py-2 pr-3 font-medium">Plan / type</th>
                <th className="py-2 pr-3 font-medium">Promo</th>
                <th className="py-2 pr-3 font-medium">Credits</th>
                <th className="py-2 pr-3 font-medium">Amount</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-b border-[#E8DDD4]/60">
                  <td className="py-3 pr-3 whitespace-nowrap">
                    {s.soldAtDateKey}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="font-medium">{s.clientName}</div>
                    <div className="text-xs text-[#716D64]">{s.clientEmail}</div>
                  </td>
                  <td className="py-3 pr-3">
                    <div>{s.planTitle || "—"}</div>
                    <div className="text-xs text-[#716D64]">
                      {s.itemName || ""}
                    </div>
                  </td>
                  <td className="py-3 pr-3">{s.promotionName || "—"}</td>
                  <td className="py-3 pr-3">{s.classCount}</td>
                  <td className="py-3 pr-3">
                    {s.status === "refunded"
                      ? money(s.refundAmountRm ?? s.amountRm)
                      : money(s.amountRm)}
                  </td>
                  <td className="py-3 pr-3">
                    <Pill
                      label={s.status}
                      tone={s.status === "paid" ? "good" : "warn"}
                    />
                  </td>
                  <td className="py-3">
                    <div className="flex flex-col items-start gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setReceiptSale({
                            id: s.id,
                            receiptNo: s.receiptNo,
                            soldAt: s.soldAt,
                            clientName: s.clientName,
                            clientEmail: s.clientEmail,
                            clientWhatsapp: s.clientWhatsapp,
                            planTitle: s.planTitle,
                            itemName: s.itemName,
                            classCount: s.classCount,
                            listPriceRm: s.listPriceRm,
                            amountRm: s.amountRm,
                            status: s.status,
                            paymentMethod: s.paymentMethod,
                            promotionName: s.promotionName,
                          })
                        }
                        className="text-xs underline text-[#A66A4A] hover:text-[#444444] cursor-pointer"
                      >
                        Receipt download
                      </button>
                      {s.status === "paid" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setRefundId(s.id);
                            setRefundAmount(s.amountRm);
                            setRefundNote("");
                          }}
                          className="text-xs underline text-[#716D64] hover:text-[#444444] cursor-pointer"
                        >
                          Refund
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {refundId ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setRefundId(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-3xl border border-[#E8DDD4] bg-[#FAF8F6] p-6 shadow-lg">
            <h3 className="font-serif text-lg font-semibold">Refund sale</h3>
            <p className="mt-1 text-sm text-[#716D64]">
              Marks the sale as refunded and recalls granted credits when a
              client was linked.
            </p>
            <label className="mt-4 grid gap-1">
              <span className="text-xs text-[#716D64]">Refund amount (RM)</span>
              <input
                type="number"
                min={0}
                value={refundAmount}
                onChange={(e) => setRefundAmount(Number(e.target.value) || 0)}
                className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
              />
            </label>
            <label className="mt-3 grid gap-1">
              <span className="text-xs text-[#716D64]">Note</span>
              <input
                value={refundNote}
                onChange={(e) => setRefundNote(e.target.value)}
                className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefundId(null)}
                className={cn(
                  "rounded-full border border-[#E8DDD4] bg-white px-4 py-2 text-sm cursor-pointer",
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={refunding}
                onClick={() => void confirmRefund()}
                className="rounded-full bg-[#A66A4A] text-white px-4 py-2 text-sm disabled:opacity-50 cursor-pointer"
              >
                {refunding ? "Refunding…" : "Confirm refund"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {receiptSale ? (
        <SaleReceiptModal
          sale={receiptSale}
          onClose={() => setReceiptSale(null)}
        />
      ) : null}
    </div>
  );
}
