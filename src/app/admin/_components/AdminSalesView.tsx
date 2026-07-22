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
import { Checkbox } from "@/components/Checkbox";
import { Pill } from "./Pill";
import { SaleReceiptModal } from "./SaleReceipt";
import type { ReceiptSaleView } from "@/lib/studioReceipt";
import {
  CASH_EXPENSE_CATEGORIES,
  CASH_INCOME_CATEGORIES,
} from "@/lib/cashTransactions";

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
type ProductOption = {
  id: string;
  name: string;
  priceRm: number;
  active: boolean;
};
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
  saleKind: "plan" | "product";
  planTitle: string;
  itemName: string;
  productName: string;
  quantity: number | null;
  promotionName: string;
  classCount: number;
  validityDays: number;
  listPriceRm: number;
  amountRm: number;
  status: "paid" | "refunded";
  refundAmountRm: number | null;
  note: string;
  clientId: string | null;
  receiptNo: string;
  paymentMethod: string;
};

type EditSaleForm = {
  soldAt: string;
  clientName: string;
  clientEmail: string;
  clientWhatsapp: string;
  quantity: number;
  classCount: number;
  validityDays: number;
  listPriceRm: number;
  amountRm: number;
  paymentMethod: string;
  note: string;
};

type CashRow = {
  id: string;
  kind: "income" | "expense";
  occurredAt: string;
  occurredAtDateKey: string;
  amountRm: number;
  category: string;
  description: string;
  note: string;
  status: "recorded" | "voided";
};

type CashTotals = {
  otherIncome: number;
  otherExpense: number;
  otherNet: number;
};

type BreakdownRow = {
  label: string;
  amount: number;
  count: number;
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
  byProduct: Array<{ label: string; revenue: number; count: number }>;
  byPromotion: Array<{ label: string; revenue: number; count: number }>;
};

function money(n: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(n);
}

function BreakdownCard({
  title,
  description,
  rows,
  expense = false,
}: {
  title: string;
  description: string;
  rows: BreakdownRow[];
  expense?: boolean;
}) {
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
  return (
    <section className="rounded-3xl border border-[#E8DDD4] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg font-semibold">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-[#716D64]">
            {description}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#F3ECE7] px-2.5 py-1 text-xs text-[#716D64]">
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="mt-5 rounded-2xl bg-[#FAF8F6] px-4 py-6 text-center text-sm text-[#716D64]">
          No data in this period
        </div>
      ) : (
        <ol className="mt-5 space-y-4">
          {rows.slice(0, 8).map((row, index) => {
            const share =
              totalAmount > 0 ? (row.amount / totalAmount) * 100 : 0;
            return (
              <li key={row.label}>
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F3ECE7] text-xs font-semibold text-[#A66A4A]">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="truncate text-sm font-medium text-[#444444]">
                        {row.label}
                      </span>
                      <div className="shrink-0 text-right">
                        <div
                          className={cn(
                            "text-sm font-semibold",
                            expense ? "text-[#A66A4A]" : "text-[#444444]",
                          )}
                        >
                          {expense ? "−" : ""}
                          {money(row.amount)}
                        </div>
                        <div className="text-[11px] text-[#716D64]">
                          {share.toFixed(1)}% share · {row.count}{" "}
                          {row.count === 1 ? "entry" : "entries"}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F3ECE7]">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          expense ? "bg-[#C98F73]" : "bg-[#A66A4A]",
                        )}
                        style={{ width: `${Math.max(3, share)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function defaultRange() {
  const now = DateTime.now().setZone(BUSINESS_TIME_ZONE);
  return {
    from: now.startOf("month").toISODate() ?? "",
    to: now.endOf("month").toISODate() ?? "",
  };
}

export function AdminSalesView() {
  const [activePanel, setActivePanel] = useState<
    "overview" | "record" | "history" | "cash"
  >("overview");
  const [range, setRange] = useState(defaultRange);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [promos, setPromos] = useState<PromoOption[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashRow[]>([]);
  const [cashTotals, setCashTotals] = useState<CashTotals>({
    otherIncome: 0,
    otherExpense: 0,
    otherNet: 0,
  });
  const [byOtherIncome, setByOtherIncome] = useState<BreakdownRow[]>([]);
  const [outcomeRanking, setOutcomeRanking] = useState<BreakdownRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [productSaving, setProductSaving] = useState(false);

  const [soldAt, setSoldAt] = useState(
    () => DateTime.now().setZone(BUSINESS_TIME_ZONE).toISODate() ?? "",
  );
  const [clientQuery, setClientQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ClientSuggest[]>([]);
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientSuggest | null>(
    null,
  );
  const [saleKind, setSaleKind] = useState<"plan" | "product">("plan");
  const [planId, setPlanId] = useState("");
  const [itemId, setItemId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [promotionId, setPromotionId] = useState("");
  const [priceMode, setPriceMode] = useState<PriceMode>("regular");
  const [classCount, setClassCount] = useState(0);
  const [validityDays, setValidityDays] = useState(30);
  const [listPriceRm, setListPriceRm] = useState(0);
  const [amountRm, setAmountRm] = useState(0);
  const [amountOverridden, setAmountOverridden] = useState(false);
  const [note, setNote] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState(0);
  const [cashKind, setCashKind] = useState<"income" | "expense">("expense");
  const [cashOccurredAt, setCashOccurredAt] = useState(
    () => DateTime.now().setZone(BUSINESS_TIME_ZONE).toISODate() ?? "",
  );
  const [cashAmountRm, setCashAmountRm] = useState(0);
  const [cashCategory, setCashCategory] = useState("Rent");
  const [cashDescription, setCashDescription] = useState("");
  const [cashNote, setCashNote] = useState("");
  const [cashSaving, setCashSaving] = useState(false);
  const [voidingCashId, setVoidingCashId] = useState<string | null>(null);

  const [refundId, setRefundId] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundNote, setRefundNote] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [receiptSale, setReceiptSale] = useState<ReceiptSaleView | null>(null);
  const [editingSale, setEditingSale] = useState<SaleRow | null>(null);
  const [editSaleForm, setEditSaleForm] = useState<EditSaleForm | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const clientComboRef = useRef<HTMLDivElement>(null);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === planId) ?? null,
    [plans, planId],
  );
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId],
  );
  const selectedPromo = useMemo(
    () => promos.find((p) => p.id === promotionId) ?? null,
    [promos, promotionId],
  );

  const computedAmountRm = useMemo(() => {
    if (saleKind === "product") return listPriceRm;
    return applyPromotionDiscount(listPriceRm, selectedPromo);
  }, [listPriceRm, selectedPromo, saleKind]);

  useEffect(() => {
    if (!amountOverridden) setAmountRm(computedAmountRm);
  }, [computedAmountRm, amountOverridden]);

  const loadMeta = useCallback(async () => {
    const [plansRes, itemsRes, promoRes, productsRes] = await Promise.all([
      fetch("/api/admin/plans", { cache: "no-store" }),
      fetch("/api/admin/items", { cache: "no-store" }),
      fetch("/api/admin/promotions?active=1", { cache: "no-store" }),
      fetch("/api/admin/shop-products", { cache: "no-store" }),
    ]);
    const plansJson = await plansRes.json();
    const itemsJson = await itemsRes.json();
    const promoJson = await promoRes.json();
    const productsJson = await productsRes.json();
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
    if (productsJson?.ok) {
      setProducts(
        (productsJson.data.products ?? []).map(
          (p: {
            id: string;
            name: string;
            priceRm: number;
            active: boolean;
          }) => p,
        ),
      );
    }
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

  const loadCashTransactions = useCallback(async () => {
    try {
      const qs = new URLSearchParams({
        from: range.from,
        to: range.to,
        status: "all",
        kind: "all",
      });
      const res = await fetch(`/api/admin/cash-transactions?${qs}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.error?.message ?? "Failed to load other cash entries",
        );
      }
      setCashTransactions(json.data.transactions ?? []);
      setCashTotals(
        json.data.totals ?? {
          otherIncome: 0,
          otherExpense: 0,
          otherNet: 0,
        },
      );
      setByOtherIncome(json.data.byOtherIncome ?? []);
      setOutcomeRanking(json.data.outcomeRanking ?? []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load other cash entries",
      );
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadSalesAndStats();
  }, [loadSalesAndStats]);

  useEffect(() => {
    void loadCashTransactions();
  }, [loadCashTransactions]);

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

  function applyProduct(id: string) {
    setProductId(id);
    const product = products.find((p) => p.id === id);
    if (!product) return;
    setListPriceRm(product.priceRm * Math.max(1, quantity));
    setAmountOverridden(false);
    setClassCount(0);
    setValidityDays(0);
  }

  function switchSaleKind(next: "plan" | "product") {
    setSaleKind(next);
    setAmountOverridden(false);
    setError(null);
    if (next === "product") {
      setPlanId("");
      setItemId("");
      setPromotionId("");
      setClassCount(0);
      setValidityDays(0);
      setPriceMode("regular");
      if (selectedProduct) {
        setListPriceRm(selectedProduct.priceRm * Math.max(1, quantity));
      } else {
        setListPriceRm(0);
        setAmountRm(0);
      }
    } else {
      setProductId("");
      setQuantity(1);
      setValidityDays(30);
      setListPriceRm(0);
      setAmountRm(0);
    }
  }

  useEffect(() => {
    if (saleKind !== "plan" || !selectedPlan) return;
    setListPriceRm(planListPrice(selectedPlan, priceMode));
    setAmountOverridden(false);
  }, [priceMode, selectedPlan, saleKind]);

  useEffect(() => {
    if (saleKind !== "product" || !selectedProduct) return;
    setListPriceRm(selectedProduct.priceRm * Math.max(1, quantity));
    setAmountOverridden(false);
  }, [quantity, selectedProduct, saleKind]);

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
    if (saleKind === "product" && !productId) {
      setError("Select a product");
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
          saleKind,
          planId: saleKind === "plan" ? planId || undefined : undefined,
          itemId: saleKind === "plan" ? itemId || undefined : undefined,
          productId: saleKind === "product" ? productId || undefined : undefined,
          quantity: saleKind === "product" ? Math.max(1, quantity) : undefined,
          promotionId:
            saleKind === "plan" ? promotionId || undefined : undefined,
          classCount: saleKind === "product" ? 0 : classCount,
          validityDays: saleKind === "product" ? 0 : validityDays,
          listPriceRm,
          computedAmountRm,
          amountRm,
          amountOverridden,
          note: note.trim() || undefined,
          priceMode: saleKind === "plan" ? priceMode : undefined,
          useStudentPrice:
            saleKind === "plan" ? priceMode === "student" : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Save failed");
      }
      clearClient();
      setPlanId("");
      setItemId("");
      setProductId("");
      setQuantity(1);
      setPromotionId("");
      setClassCount(0);
      setValidityDays(saleKind === "product" ? 0 : 30);
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

  async function addShopProduct() {
    const name = newProductName.trim();
    if (!name) {
      setError("Product name is required");
      return;
    }
    setProductSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/shop-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          priceRm: Number(newProductPrice) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Failed to add product");
      }
      setNewProductName("");
      setNewProductPrice(0);
      await loadMeta();
      const createdId = json.data?.product?.id as string | undefined;
      if (createdId) {
        setSaleKind("product");
        setProductId(createdId);
        setListPriceRm((json.data.product.priceRm as number) || 0);
        setAmountOverridden(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add product");
    } finally {
      setProductSaving(false);
    }
  }

  async function toggleProductActive(id: string, active: boolean) {
    try {
      const res = await fetch(`/api/admin/shop-products/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Update failed");
      }
      await loadMeta();
      if (!active && productId === id) setProductId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  function openEditSale(sale: SaleRow) {
    setEditingSale(sale);
    setEditSaleForm({
      soldAt: sale.soldAtDateKey || sale.soldAt.slice(0, 10),
      clientName: sale.clientName,
      clientEmail: sale.clientEmail,
      clientWhatsapp: sale.clientWhatsapp,
      quantity: sale.quantity ?? 1,
      classCount: sale.classCount,
      validityDays: sale.validityDays,
      listPriceRm: sale.listPriceRm,
      amountRm: sale.amountRm,
      paymentMethod: sale.paymentMethod || "Online transfer",
      note: sale.note,
    });
    setError(null);
  }

  function closeEditSale() {
    if (editSaving) return;
    setEditingSale(null);
    setEditSaleForm(null);
  }

  async function submitSaleEdit() {
    if (!editingSale || !editSaleForm) return;
    if (!editSaleForm.clientName.trim()) {
      setError("Client name is required");
      return;
    }
    setEditSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/sales/${encodeURIComponent(editingSale.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editSaleForm),
        },
      );
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Update failed");
      }
      setEditingSale(null);
      setEditSaleForm(null);
      await Promise.all([loadSalesAndStats(), loadCashTransactions()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setEditSaving(false);
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

  function switchCashKind(next: "income" | "expense") {
    setCashKind(next);
    setCashCategory(
      next === "income"
        ? CASH_INCOME_CATEGORIES[0]
        : CASH_EXPENSE_CATEGORIES[0],
    );
    setError(null);
  }

  async function submitCashTransaction() {
    if (!(cashAmountRm > 0)) {
      setError("Amount must be greater than 0");
      return;
    }
    if (!cashCategory.trim() || !cashDescription.trim()) {
      setError("Category and description are required");
      return;
    }
    setCashSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/cash-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: cashKind,
          occurredAt: cashOccurredAt,
          amountRm: cashAmountRm,
          category: cashCategory.trim(),
          description: cashDescription.trim(),
          note: cashNote.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Save failed");
      }
      setCashAmountRm(0);
      setCashDescription("");
      setCashNote("");
      await loadCashTransactions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setCashSaving(false);
    }
  }

  async function voidCashTransaction(id: string) {
    setVoidingCashId(id);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/cash-transactions/${encodeURIComponent(id)}/void`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Void failed");
      }
      await loadCashTransactions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Void failed");
    } finally {
      setVoidingCashId(null);
    }
  }

  const kpis = stats?.kpis;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#E8DDD4] bg-white/80 p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-[#A66A4A]">
              Shop finance
            </div>
            <h1 className="mt-1 font-serif text-2xl font-semibold">Sales</h1>
            <p className="mt-1 text-sm text-[#716D64]">
              Review performance, record sales, and manage shop cash.
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
        <nav
          className="mt-5 flex gap-2 overflow-x-auto"
          aria-label="Sales sections"
          role="tablist"
        >
          {(
            [
              ["overview", "Overview"],
              ["record", "Record sale"],
              ["history", "Sales history"],
              ["cash", "Other cash"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActivePanel(id)}
              aria-current={activePanel === id ? "page" : undefined}
              aria-selected={activePanel === id}
              role="tab"
              className={cn(
                "shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition-all cursor-pointer active:scale-[0.98]",
                activePanel === id
                  ? "border-[#A66A4A] bg-[#A66A4A] text-white shadow-sm"
                  : "border-[#E8DDD4] bg-white text-[#716D64] hover:-translate-y-0.5 hover:border-[#C9A996] hover:bg-[#FAF8F6] hover:text-[#444444] hover:shadow-md",
              )}
            >
              {label}
            </button>
          ))}
        </nav>
      </section>

      {activePanel === "overview" ? (
      <section className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
        <div>
          <h2 className="font-serif text-xl font-semibold">Overview</h2>
          <p className="mt-1 text-sm text-[#716D64]">
            Plan and product sales for the selected period.
          </p>
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

        <div className="mt-8 border-t border-[#E8DDD4] pt-7">
          <h2 className="font-serif text-xl font-semibold">Performance details</h2>
          <p className="mt-1 text-sm text-[#716D64]">
            Ranked breakdowns for sales, other income, and shop expenses.
          </p>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <BreakdownCard
              title="By plan"
              description="Plan packages ranked by paid revenue."
              rows={(stats?.byPlan ?? []).map((row) => ({
                label: row.label,
                amount: row.revenue,
                count: row.count,
              }))}
            />
            <BreakdownCard
              title="By class type"
              description="Class types ranked by paid plan sales."
              rows={(stats?.byItem ?? []).map((row) => ({
                label: row.label,
                amount: row.revenue,
                count: row.count,
              }))}
            />
            <BreakdownCard
              title="By promotion"
              description="Revenue recorded with each promotion."
              rows={(stats?.byPromotion ?? []).map((row) => ({
                label: row.label,
                amount: row.revenue,
                count: row.count,
              }))}
            />
            <BreakdownCard
              title="By items"
              description="Retail products ranked by paid sales."
              rows={(stats?.byProduct ?? []).map((row) => ({
                label: row.label,
                amount: row.revenue,
                count: row.count,
              }))}
            />
            <BreakdownCard
              title="By others"
              description="Other income ranked by category."
              rows={byOtherIncome}
            />
            <BreakdownCard
              title="Outcome ranking"
              description="Shop expenses ranked by category."
              rows={outcomeRanking}
              expense
            />
          </div>
        </div>
      </section>
      ) : null}

      {activePanel === "cash" ? (
      <section className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
        <div>
          <h2 className="font-serif text-xl font-semibold">Other cash</h2>
          <p className="mt-1 text-sm text-[#716D64]">
            Record shop income and expenses that are not plan or product sales.
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Other income",
              value: money(cashTotals.otherIncome),
              hint: "Recorded income",
            },
            {
              label: "Other expense",
              value: money(cashTotals.otherExpense),
              hint: "Recorded expenses",
            },
            {
              label: "Other cash net",
              value: money(cashTotals.otherNet),
              hint: "Income − expenses",
            },
            {
              label: "Total net cash",
              value: money((kpis?.netRevenue ?? 0) + cashTotals.otherNet),
              hint: "Sales net + other cash net",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-3xl border border-[#E8DDD4] bg-white p-5 shadow-sm"
            >
              <div className="text-sm text-[#716D64]">{card.label}</div>
              <div className="mt-2 font-serif text-2xl font-semibold">
                {card.value}
              </div>
              <div className="mt-1 text-xs text-[#716D64]">{card.hint}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-3xl border border-[#E8DDD4] bg-white/60 p-5">
          <h3 className="font-serif text-lg font-semibold">Record other cash</h3>
          <div className="mt-4 flex flex-wrap gap-6">
            <Checkbox
              checked={cashKind === "income"}
              onCheckedChange={(on) => {
                if (on) switchCashKind("income");
              }}
              label="Income"
            />
            <Checkbox
              checked={cashKind === "expense"}
              onCheckedChange={(on) => {
                if (on) switchCashKind("expense");
              }}
              label="Expense"
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">Date</span>
              <input
                type="date"
                value={cashOccurredAt}
                onChange={(e) => setCashOccurredAt(e.target.value)}
                className="w-full min-w-0 rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">Amount (RM)</span>
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={cashAmountRm || ""}
                onChange={(e) => setCashAmountRm(Number(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full min-w-0 rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">Category</span>
              <input
                value={cashCategory}
                onChange={(e) => setCashCategory(e.target.value)}
                list={`cash-${cashKind}-categories`}
                className="w-full min-w-0 rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
              />
              <datalist id={`cash-${cashKind}-categories`}>
                {(cashKind === "income"
                  ? CASH_INCOME_CATEGORIES
                  : CASH_EXPENSE_CATEGORIES
                ).map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">Description</span>
              <input
                value={cashDescription}
                onChange={(e) => setCashDescription(e.target.value)}
                placeholder="What was this for?"
                className="w-full min-w-0 rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
              />
            </label>
            <label className="grid gap-1 sm:col-span-2 lg:col-span-3">
              <span className="text-xs text-[#716D64]">Note (optional)</span>
              <input
                value={cashNote}
                onChange={(e) => setCashNote(e.target.value)}
                placeholder="Extra details"
                className="w-full min-w-0 rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={cashSaving}
              onClick={() => void submitCashTransaction()}
              className="self-end rounded-full bg-[#DFD1C9] px-5 py-3 text-sm font-medium hover:brightness-95 disabled:opacity-50 cursor-pointer"
            >
              {cashSaving ? "Saving…" : "Save entry"}
            </button>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-[#E8DDD4]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#F3ECE7] text-xs text-[#716D64]">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DDD4] bg-white/70">
              {cashTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-[#716D64]"
                  >
                    No other cash entries in this range.
                  </td>
                </tr>
              ) : (
                cashTransactions.map((txn) => (
                  <tr
                    key={txn.id}
                    className={cn(txn.status === "voided" && "opacity-45")}
                  >
                    <td className="px-4 py-3">{txn.occurredAtDateKey}</td>
                    <td className="px-4 py-3">
                      <Pill
                        label={
                          txn.status === "voided" ? "voided" : txn.kind
                        }
                        tone={
                          txn.status === "voided"
                            ? "warn"
                            : txn.kind === "income"
                              ? "good"
                              : "warn"
                        }
                      />
                    </td>
                    <td className="px-4 py-3">{txn.category}</td>
                    <td className="px-4 py-3">
                      <div>{txn.description}</div>
                      {txn.note ? (
                        <div className="mt-0.5 text-xs text-[#716D64]">
                          {txn.note}
                        </div>
                      ) : null}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-medium",
                        txn.kind === "income"
                          ? "text-[#1B7A3D]"
                          : "text-[#A66A4A]",
                      )}
                    >
                      {txn.kind === "income" ? "+" : "−"}
                      {money(txn.amountRm)}
                    </td>
                    <td className="px-4 py-3">
                      {txn.status === "recorded" ? (
                        <button
                          type="button"
                          disabled={voidingCashId === txn.id}
                          onClick={() => void voidCashTransaction(txn.id)}
                          className="text-xs underline text-[#716D64] hover:text-[#444444] disabled:opacity-50 cursor-pointer"
                        >
                          {voidingCashId === txn.id ? "Voiding…" : "Void"}
                        </button>
                      ) : (
                        <span className="text-xs text-[#716D64]">Voided</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      {activePanel === "record" ? (
      <div className="flex flex-col gap-6">
      <details
        className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm"
        style={{ order: 2 }}
      >
        <summary className="cursor-pointer list-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg font-semibold">
                Product catalogue
              </h2>
              <p className="mt-1 text-sm text-[#716D64]">
                Add or deactivate retail products.
              </p>
            </div>
            <span className="rounded-full bg-[#F3ECE7] px-3 py-1 text-xs text-[#716D64]">
              Manage
            </span>
          </div>
        </summary>
        <div className="mt-5 border-t border-[#E8DDD4] pt-5">
        <h2 className="font-serif text-xl font-semibold">Shop products</h2>
        <p className="mt-1 text-sm text-[#716D64]">
          Register simple retail items (name + unit price) for product sales.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_8rem_auto]">
          <input
            value={newProductName}
            onChange={(e) => setNewProductName(e.target.value)}
            placeholder="Product name"
            className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            value={newProductPrice}
            onChange={(e) => setNewProductPrice(Number(e.target.value) || 0)}
            placeholder="Price RM"
            className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
          />
          <button
            type="button"
            disabled={productSaving}
            onClick={() => void addShopProduct()}
            className="rounded-full bg-[#DFD1C9] px-5 py-3 text-sm font-medium hover:brightness-95 disabled:opacity-50 cursor-pointer"
          >
            {productSaving ? "Adding…" : "Add product"}
          </button>
        </div>
        {products.length > 0 ? (
          <ul className="mt-4 divide-y divide-[#E8DDD4]/80 rounded-2xl border border-[#E8DDD4] bg-white/60">
            {products.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <div className={cn(!p.active && "opacity-50")}>
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 text-[#716D64]">RM {p.priceRm}</span>
                  {!p.active ? (
                    <span className="ml-2 text-xs text-[#A66A4A]">inactive</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void toggleProductActive(p.id, !p.active)}
                  className="text-xs underline text-[#716D64] hover:text-[#444444] cursor-pointer"
                >
                  {p.active ? "Deactivate" : "Activate"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[#716D64]">No products yet.</p>
        )}
        </div>
      </details>

      <section
        className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm"
        style={{ order: 1 }}
      >
        <h2 className="font-serif text-xl font-semibold">Record a sale</h2>
        <div className="mt-4 flex flex-wrap gap-6">
          <Checkbox
            checked={saleKind === "plan"}
            onCheckedChange={(on) => {
              if (on) switchSaleKind("plan");
            }}
            label="Plan sale"
          />
          <Checkbox
            checked={saleKind === "product"}
            onCheckedChange={(on) => {
              if (on) switchSaleKind("product");
            }}
            label="Product sale"
          />
        </div>
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
          {saleKind === "product" ? (
            <>
              <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">Product</span>
                <select
                  value={productId}
                  onChange={(e) => applyProduct(e.target.value)}
                  className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
                >
                  <option value="">Select product…</option>
                  {products
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · RM {p.priceRm}
                      </option>
                    ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">Quantity</span>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
                />
              </label>
            </>
          ) : (
            <>
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
                  onChange={(e) =>
                    setValidityDays(Number(e.target.value) || 30)
                  }
                  className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
                />
              </label>
            </>
          )}
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
      </div>
      ) : null}

      {activePanel === "history" ? (
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
                <th className="py-2 pr-3 font-medium">Kind / item</th>
                <th className="py-2 pr-3 font-medium">Promo</th>
                <th className="py-2 pr-3 font-medium">Credits / qty</th>
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
                    <div>
                      {s.saleKind === "product"
                        ? s.productName || "Product"
                        : s.planTitle || "—"}
                    </div>
                    <div className="text-xs text-[#716D64]">
                      {s.saleKind === "product"
                        ? "Product sale"
                        : s.itemName || "Plan sale"}
                    </div>
                  </td>
                  <td className="py-3 pr-3">{s.promotionName || "—"}</td>
                  <td className="py-3 pr-3">
                    {s.saleKind === "product"
                      ? `×${s.quantity ?? 1}`
                      : s.classCount}
                  </td>
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
                        onClick={() => openEditSale(s)}
                        className="text-xs font-medium underline text-[#A66A4A] hover:text-[#444444] cursor-pointer"
                      >
                        Edit
                      </button>
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
                            planTitle:
                              s.saleKind === "product"
                                ? s.productName || "Product"
                                : s.planTitle,
                            itemName:
                              s.saleKind === "product" ? "" : s.itemName,
                            quantity:
                              s.saleKind === "product"
                                ? s.quantity ?? 1
                                : 1,
                            classCount:
                              s.saleKind === "product" ? 0 : s.classCount,
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
      ) : null}

      {editingSale && editSaleForm ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center overflow-y-auto p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close edit sale"
            onClick={closeEditSale}
          />
          <div className="relative z-10 my-6 w-full max-w-2xl rounded-3xl border border-[#E8DDD4] bg-[#FAF8F6] p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-[#A66A4A]">
                  Edit sale
                </div>
                <h3 className="mt-1 font-serif text-2xl font-semibold">
                  {editingSale.saleKind === "product"
                    ? editingSale.productName || "Product sale"
                    : editingSale.planTitle || "Plan sale"}
                </h3>
                <p className="mt-1 text-sm text-[#716D64]">
                  {editingSale.receiptNo}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditSale}
                className="rounded-full border border-[#E8DDD4] bg-white px-3 py-1.5 text-xs cursor-pointer"
              >
                Close
              </button>
            </div>

            {editingSale.status === "refunded" ? (
              <div className="mt-4 rounded-2xl bg-[#FFF4E5] px-4 py-3 text-sm text-[#8A5A24]">
                This sale is refunded. Changes keep its refunded status.
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">Sale date</span>
                <input
                  type="date"
                  value={editSaleForm.soldAt}
                  onChange={(e) =>
                    setEditSaleForm((form) =>
                      form ? { ...form, soldAt: e.target.value } : form,
                    )
                  }
                  className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">Client name</span>
                <input
                  value={editSaleForm.clientName}
                  onChange={(e) =>
                    setEditSaleForm((form) =>
                      form ? { ...form, clientName: e.target.value } : form,
                    )
                  }
                  className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">Email</span>
                <input
                  type="email"
                  value={editSaleForm.clientEmail}
                  onChange={(e) =>
                    setEditSaleForm((form) =>
                      form ? { ...form, clientEmail: e.target.value } : form,
                    )
                  }
                  className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">WhatsApp</span>
                <input
                  value={editSaleForm.clientWhatsapp}
                  onChange={(e) =>
                    setEditSaleForm((form) =>
                      form
                        ? { ...form, clientWhatsapp: e.target.value }
                        : form,
                    )
                  }
                  className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
                />
              </label>
              {editingSale.saleKind === "product" ? (
                <label className="grid gap-1">
                  <span className="text-xs text-[#716D64]">Quantity</span>
                  <input
                    type="number"
                    min={1}
                    value={editSaleForm.quantity}
                    onChange={(e) =>
                      setEditSaleForm((form) =>
                        form
                          ? {
                              ...form,
                              quantity: Math.max(
                                1,
                                Number(e.target.value) || 1,
                              ),
                            }
                          : form,
                      )
                    }
                    className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
                  />
                </label>
              ) : (
                <>
                  <label className="grid gap-1">
                    <span className="text-xs text-[#716D64]">Credits</span>
                    <input
                      type="number"
                      min={0}
                      value={editSaleForm.classCount}
                      onChange={(e) =>
                        setEditSaleForm((form) =>
                          form
                            ? {
                                ...form,
                                classCount: Number(e.target.value) || 0,
                              }
                            : form,
                        )
                      }
                      className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-[#716D64]">
                      Validity (days)
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={editSaleForm.validityDays}
                      onChange={(e) =>
                        setEditSaleForm((form) =>
                          form
                            ? {
                                ...form,
                                validityDays: Number(e.target.value) || 0,
                              }
                            : form,
                        )
                      }
                      className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
                    />
                  </label>
                </>
              )}
              <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">List price (RM)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editSaleForm.listPriceRm}
                  onChange={(e) =>
                    setEditSaleForm((form) =>
                      form
                        ? {
                            ...form,
                            listPriceRm: Number(e.target.value) || 0,
                          }
                        : form,
                    )
                  }
                  className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">Paid amount (RM)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editSaleForm.amountRm}
                  onChange={(e) =>
                    setEditSaleForm((form) =>
                      form
                        ? { ...form, amountRm: Number(e.target.value) || 0 }
                        : form,
                    )
                  }
                  className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">Payment method</span>
                <input
                  value={editSaleForm.paymentMethod}
                  onChange={(e) =>
                    setEditSaleForm((form) =>
                      form ? { ...form, paymentMethod: e.target.value } : form,
                    )
                  }
                  className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
                />
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs text-[#716D64]">Note</span>
                <textarea
                  rows={3}
                  value={editSaleForm.note}
                  onChange={(e) =>
                    setEditSaleForm((form) =>
                      form ? { ...form, note: e.target.value } : form,
                    )
                  }
                  className="resize-none rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
                />
              </label>
            </div>
            {error ? (
              <div className="mt-3 text-sm text-red-700">{error}</div>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={editSaving}
                onClick={closeEditSale}
                className="rounded-full border border-[#E8DDD4] bg-white px-5 py-2.5 text-sm disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={() => void submitSaleEdit()}
                className="rounded-full bg-[#A66A4A] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 cursor-pointer"
              >
                {editSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
