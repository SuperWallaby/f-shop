"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { minutesToAmPmRange } from "@/app/admin/_lib/adminTime";
import { CreditExpiryBannerStack } from "@/components/CreditExpiryBannerStack";
import { cn } from "@/lib/cn";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import ArrowLeftIcon from "@heroicons/react/24/outline/ArrowLeftIcon";
import PlusIcon from "@heroicons/react/24/outline/PlusIcon";
import { Skeleton, SkeletonLine } from "./Skeleton";

type OrderHistoryEntry = {
  id: string;
  orderRef: string;
  planTitle: string;
  status: "pending" | "paid" | "cancelled";
  quantity?: number;
  classCount: number;
  amountRm: number;
  createdAt: string;
  paidAt: string | null;
  saleId?: string | null;
};

type BookingHistoryEntry = {
  id: string;
  code: string;
  dateKey: string;
  status: string;
  startMin: number;
  endMin: number;
  itemName: string;
};

type ClientRow = {
  client: {
    id: string;
    name: string;
    email: string;
    whatsapp: string;
    studentStatus: "none" | "pending" | "verified" | "rejected";
    createdAt?: string;
  };
  balance: {
    balance: number;
    rawBalance?: number;
    expiringCredits: Array<{ amount: number; expiresAt: string; source: string }>;
    expiryAlerts?: Array<{
      expiresAt: string;
      windowStart: string;
      windowEnd: string;
      credits: number;
      expiryApproved: boolean;
      showBanner: boolean;
      ledgerIds: string[];
    }>;
  };
  ordersHistory: OrderHistoryEntry[];
  bookingHistory: BookingHistoryEntry[];
};

function todayDateKey() {
  return DateTime.now().setZone(BUSINESS_TIME_ZONE).toISODate() ?? "";
}

function isoToDateKey(iso: string | null | undefined) {
  if (!iso) return todayDateKey();
  return (
    DateTime.fromISO(iso, { zone: BUSINESS_TIME_ZONE }).toISODate() ??
    todayDateKey()
  );
}

function fmtShortDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function fmtDateKey(dateKey: string) {
  try {
    const [y, m, d] = dateKey.split("-").map(Number);
    if (!y || !m || !d) return dateKey;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      dateStyle: "medium",
    });
  } catch {
    return dateKey;
  }
}

function StudentPill({
  status,
}: {
  status: ClientRow["client"]["studentStatus"];
}) {
  const label =
    status === "none"
      ? "—"
      : status === "pending"
        ? "Pending"
        : status === "verified"
          ? "Verified"
          : "Rejected";
  const cls =
    status === "verified"
      ? "bg-[#E8F5EE] text-[#1F6B3C] border-[#B8DCC6]"
      : status === "pending"
        ? "bg-[#FFF7E6] text-[#8A5A00] border-[#F2D3A2]"
        : status === "rejected"
          ? "bg-[#FCE8E6] text-[#B42318] border-[#F1B3B0]"
          : "bg-[#F5F5F4] text-[#716D64] border-[#E8DDD4]";
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

function OrderStatusPill({ status }: { status: OrderHistoryEntry["status"] }) {
  const cls =
    status === "paid"
      ? "bg-[#E8F5EE] text-[#1F6B3C] border-[#B8DCC6]"
      : status === "pending"
        ? "bg-[#FFF7E6] text-[#8A5A00] border-[#F2D3A2]"
        : "bg-[#F5F5F4] text-[#716D64] border-[#E8DDD4]";
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${cls}`}
    >
      {status}
    </span>
  );
}

function BookingStatusPill({ status }: { status: string }) {
  const label =
    status === "no_show"
      ? "No-show"
      : status === "confirmed"
        ? "Confirmed"
        : status === "cancelled"
          ? "Cancelled"
          : status;
  const cls =
    status === "confirmed"
      ? "bg-[#E8F5EE] text-[#1F6B3C] border-[#B8DCC6]"
      : status === "cancelled"
        ? "bg-[#F5F5F4] text-[#716D64] border-[#E8DDD4]"
        : status === "no_show"
          ? "bg-[#FFF7E6] text-[#8A5A00] border-[#F2D3A2]"
          : "bg-[#F5F5F4] text-[#716D64] border-[#E8DDD4]";
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

function pendingCount(row: ClientRow) {
  return row.ordersHistory.filter((o) => o.status === "pending").length;
}

type PastGuest = {
  name: string;
  email: string;
  whatsapp: string;
  bookingCount: number;
  lastDateKey: string;
  lastBookedAt: string | null;
  alreadyClient: boolean;
};

function RegisterClientModal({
  open,
  onClose,
  onRegistered,
  setError,
  setMsg,
}: {
  open: boolean;
  onClose: () => void;
  onRegistered: (clientId: string) => void;
  setError: (v: string | null) => void;
  setMsg: (v: string | null) => void;
}) {
  const [guests, setGuests] = useState<PastGuest[]>([]);
  const [guestQ, setGuestQ] = useState("");
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);
  const [existingTaken, setExistingTaken] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);

  const loadGuests = useCallback(async (q: string) => {
    const query = q.trim();
    if (!query) {
      setGuests([]);
      setLoadingGuests(false);
      return;
    }
    setLoadingGuests(true);
    try {
      const params = new URLSearchParams();
      params.set("q", query);
      const res = await fetch(
        `/api/admin/clients/past-guests?${params.toString()}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Failed to load past guests");
      }
      setGuests(json.data.guests ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load past guests");
    } finally {
      setLoadingGuests(false);
    }
  }, [setError]);

  useEffect(() => {
    if (!open) {
      setGuests([]);
      setGuestQ("");
      setSelectedKey("");
      setName("");
      setEmail("");
      setWhatsapp("");
      setExistingTaken(null);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => void loadGuests(guestQ), 200);
    return () => window.clearTimeout(t);
  }, [guestQ, open, loadGuests]);

  const showGuestList = guestQ.trim().length > 0;

  function pickGuest(g: PastGuest) {
    setSelectedKey(g.email);
    setName(g.name);
    setEmail(g.email);
    setWhatsapp(g.whatsapp);
    setGuestQ("");
    setGuests([]);
  }

  async function submit() {
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required");
      return;
    }
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          whatsapp: whatsapp.trim() || undefined,
          linkPastBookings: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        const existing = json?.error?.details?.existingClient as
          | { id?: string; name?: string; email?: string }
          | undefined;
        if (json?.error?.details?.code === "whatsapp_taken" && existing?.id) {
          setError(
            json?.error?.message ??
              "This WhatsApp is already registered to another client.",
          );
          setExistingTaken({
            id: existing.id,
            name: existing.name ?? "",
            email: existing.email ?? "",
          });
          return;
        }
        throw new Error(json?.error?.message ?? "Failed to register client");
      }
      const id = json.data?.client?.id as string;
      const created = Boolean(json.data?.created);
      setMsg(
        created
          ? "Client registered. Add purchases/credits next from Sales or Adjust credits."
          : "Existing client updated. Add purchases/credits next from Sales or Adjust credits.",
      );
      onRegistered(id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to register client");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 py-8">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-[#E8DDD4] bg-[#FAF8F6] p-6 shadow-lg">
        <h3 className="font-serif text-xl font-semibold">Register client</h3>
        <p className="mt-1 text-sm text-[#716D64]">
          Pick someone who already booked and confirm their contact info.
          Purchases and credits can be added afterward.
        </p>

        <label className="mt-5 grid gap-1">
          <span className="text-xs text-[#716D64]">Past booking contact</span>
          <input
            value={guestQ}
            onChange={(e) => setGuestQ(e.target.value)}
            placeholder="Type to search past guests…"
            className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
          />
        </label>
        {showGuestList ? (
          <div className="mt-2 max-h-36 overflow-auto rounded-2xl border border-[#E8DDD4] bg-white">
            {loadingGuests ? (
              <div className="px-4 py-3 text-sm text-[#716D64]">Loading…</div>
            ) : guests.length === 0 ? (
              <div className="px-4 py-3 text-sm text-[#716D64]">
                No matches.
              </div>
            ) : (
              <ul>
                {guests.map((g) => (
                  <li key={g.email}>
                    <button
                      type="button"
                      onClick={() => pickGuest(g)}
                      className={cn(
                        "w-full text-left px-4 py-2.5 text-sm hover:bg-[#FAF8F6] cursor-pointer border-b border-[#E8DDD4]/50 last:border-0",
                        selectedKey === g.email && "bg-[#DFD1C9]/40",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{g.name || "—"}</span>
                        {g.alreadyClient ? (
                          <span className="text-[10px] text-[#A66A4A]">
                            already client
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-[#716D64]">
                        {g.email}
                        {g.whatsapp ? ` · ${g.whatsapp}` : ""}
                        {` · ${g.bookingCount} booking${g.bookingCount === 1 ? "" : "s"}`}
                        {g.lastDateKey ? ` · last ${g.lastDateKey}` : ""}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-xs text-[#716D64]">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">WhatsApp</span>
            <input
              value={whatsapp}
              onChange={(e) => {
                setWhatsapp(e.target.value);
                setExistingTaken(null);
              }}
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
            />
          </label>
        </div>

        {existingTaken ? (
          <div className="mt-4 rounded-2xl border border-[#F2D3A2] bg-[#FFFDF8] px-4 py-3 text-sm text-[#444444]">
            <p>
              Already registered:{" "}
              <span className="font-medium">{existingTaken.name || "—"}</span>
              {existingTaken.email ? ` · ${existingTaken.email}` : ""}
            </p>
            <button
              type="button"
              className="mt-2 text-sm font-medium underline text-[#A66A4A] cursor-pointer"
              onClick={() => {
                onRegistered(existingTaken.id);
                onClose();
              }}
            >
              Open existing client
            </button>
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#E8DDD4] bg-white px-5 py-2.5 text-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="rounded-full bg-[#DFD1C9] px-5 py-2.5 text-sm font-medium hover:brightness-95 disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving…" : "Register"}
          </button>
        </div>
      </div>
    </div>
  );
}

type PlanOption = {
  id: string;
  title: string;
  classCount: number;
  priceRm: number;
  studentPriceRm?: number | null;
  active: boolean;
};

function AdminClientDetail({
  row,
  onBack,
  load,
  setError,
  setMsg,
}: {
  row: ClientRow;
  onBack: () => void;
  load: () => Promise<void>;
  setError: (v: string | null) => void;
  setMsg: (v: string | null) => void;
}) {
  const [name, setName] = useState(row.client.name);
  const [email, setEmail] = useState(row.client.email);
  const [whatsapp, setWhatsapp] = useState(row.client.whatsapp);

  const [addOrderOpen, setAddOrderOpen] = useState(false);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [orderPlanId, setOrderPlanId] = useState("");
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderClassCount, setOrderClassCount] = useState("");
  const [orderAmountRm, setOrderAmountRm] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [orderMarkPaid, setOrderMarkPaid] = useState(true);
  const [orderPaidAt, setOrderPaidAt] = useState(todayDateKey);
  const [orderSaving, setOrderSaving] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editOrderPaidAt, setEditOrderPaidAt] = useState("");
  const [editOrderSaving, setEditOrderSaving] = useState(false);

  const pendingOrders = useMemo(
    () => row.ordersHistory.filter((o) => o.status === "pending"),
    [row.ordersHistory],
  );

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === orderPlanId) ?? null,
    [plans, orderPlanId],
  );

  useEffect(() => {
    setName(row.client.name);
    setEmail(row.client.email);
    setWhatsapp(row.client.whatsapp);
  }, [row.client.id, row.client.name, row.client.email, row.client.whatsapp]);

  useEffect(() => {
    if (!addOrderOpen) return;
    let cancelled = false;
    setPlansLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/admin/plans", { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json?.ok) {
          setError(json?.error?.message ?? "Failed to load plans");
          return;
        }
        const list = ((json.data.plans ?? []) as PlanOption[]).filter(
          (p) => p.active,
        );
        setPlans(list);
      } catch {
        if (!cancelled) setError("Failed to load plans");
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addOrderOpen, setError]);

  useEffect(() => {
    if (!selectedPlan) return;
    const qty = Math.max(1, orderQuantity);
    setOrderClassCount(String(selectedPlan.classCount * qty));
    const unitPrice =
      row.client.studentStatus === "verified" &&
      typeof selectedPlan.studentPriceRm === "number"
        ? selectedPlan.studentPriceRm
        : selectedPlan.priceRm;
    setOrderAmountRm(String(unitPrice * qty));
  }, [selectedPlan, orderQuantity, row.client.studentStatus]);

  const profileDirty =
    name.trim() !== row.client.name ||
    email.trim() !== row.client.email ||
    whatsapp.trim() !== row.client.whatsapp;

  function resetAddOrderForm() {
    setOrderPlanId("");
    setOrderQuantity(1);
    setOrderClassCount("");
    setOrderAmountRm("");
    setOrderNote("");
    setOrderMarkPaid(true);
    setOrderPaidAt(todayDateKey());
  }

  async function submitAddOrder() {
    if (!orderPlanId) {
      setError("Select a plan");
      return;
    }
    const quantity = Math.max(1, Math.floor(Number(orderQuantity) || 1));
    const classCount = Number(orderClassCount);
    const amountRm = Number(orderAmountRm);
    if (!Number.isInteger(classCount) || classCount < 1) {
      setError("Credits must be a positive whole number");
      return;
    }
    if (!Number.isFinite(amountRm) || amountRm < 0) {
      setError("Amount must be a valid number");
      return;
    }
    if (orderMarkPaid && !orderPaidAt) {
      setError("Paid date is required");
      return;
    }
    const alsoCreateSale =
      orderMarkPaid &&
      window.confirm(
        "Also record this in Sales?\n\nCredits are granted only once either way.",
      );
    setOrderSaving(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clients/${row.client.id}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: orderPlanId,
          quantity,
          classCount,
          amountRm,
          markPaid: orderMarkPaid,
          alsoCreateSale,
          ...(orderMarkPaid && orderPaidAt ? { soldAt: orderPaidAt } : {}),
          ...(orderNote.trim() ? { note: orderNote.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setError(json?.error?.message ?? "Failed to add order");
        return;
      }
      const saleCreated = Boolean(json?.data?.saleCreated);
      setMsg(
        orderMarkPaid
          ? saleCreated
            ? "Order + sale recorded. Credits granted once."
            : "Order added and credits granted."
          : "Pending order added.",
      );
      setAddOrderOpen(false);
      resetAddOrderForm();
      await load();
    } finally {
      setOrderSaving(false);
    }
  }

  async function confirmOrder(orderId: string) {
    const defaultDate = todayDateKey();
    const paidDateRaw = window.prompt(
      "Paid date (YYYY-MM-DD)",
      defaultDate,
    );
    if (paidDateRaw == null) return;
    const paidDate = paidDateRaw.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
      setError("Paid date must be YYYY-MM-DD");
      return;
    }
    const alsoCreateSale = window.confirm(
      "Also record this in Sales?\n\nCredits are granted only once either way.",
    );
    setMsg(null);
    setError(null);
    const res = await fetch(`/api/admin/orders/${orderId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note: "Confirmed from admin clients view",
        alsoCreateSale,
        soldAt: paidDate,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      setError(json?.error?.message ?? "Failed to confirm order");
      return;
    }
    setMsg(
      json?.data?.saleCreated
        ? "Order confirmed + sale recorded. Credits granted once."
        : "Order confirmed and credits granted.",
    );
    await load();
  }

  function openEditOrderDate(order: OrderHistoryEntry) {
    setEditingOrderId(order.id);
    setEditOrderPaidAt(isoToDateKey(order.paidAt ?? order.createdAt));
    setError(null);
  }

  async function saveOrderDate(orderId: string) {
    if (!editOrderPaidAt) {
      setError("Paid date is required");
      return;
    }
    setEditOrderSaving(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidAt: editOrderPaidAt }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setError(json?.error?.message ?? "Failed to update order date");
        return;
      }
      setMsg("Order date updated.");
      setEditingOrderId(null);
      await load();
    } finally {
      setEditOrderSaving(false);
    }
  }

  async function denyOrder(orderId: string) {
    if (!window.confirm("Deny this order? No credits will be granted.")) return;
    setMsg(null);
    setError(null);
    const note = window.prompt("Optional note (stored on the order)")?.trim();
    const res = await fetch(`/api/admin/orders/${orderId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note ? { note } : {}),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      setError(json?.error?.message ?? "Failed to deny order");
      return;
    }
    setMsg("Order denied.");
    await load();
  }

  async function updateStudentStatus(
    clientId: string,
    studentStatus: ClientRow["client"]["studentStatus"],
  ) {
    setError(null);
    const res = await fetch(`/api/admin/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentStatus }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      setError(json?.error?.message ?? "Failed to update client");
      return;
    }
    await load();
  }

  async function adjustCredits(clientId: string) {
    const rawAmount = window.prompt("Credit adjustment amount (e.g. 1 or -1)");
    if (!rawAmount) return;
    const amount = Number(rawAmount);
    if (!Number.isInteger(amount) || amount === 0) return;
    const note = window.prompt("Required note for this adjustment")?.trim();
    if (!note) return;
    setError(null);
    const res = await fetch(`/api/admin/clients/${clientId}/credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, note }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      setError(json?.error?.message ?? "Failed to adjust credits");
      return;
    }
    setMsg("Credits adjusted.");
    await load();
  }

  async function saveProfile(clientId: string) {
    const patch: { name?: string; email?: string; whatsapp?: string } = {};
    const nt = name.trim();
    const et = email.trim();
    const wt = whatsapp.trim();
    if (nt !== row.client.name) patch.name = nt;
    if (et !== row.client.email) patch.email = et;
    if (wt !== row.client.whatsapp) patch.whatsapp = wt;
    if (Object.keys(patch).length === 0) return;
    setError(null);
    setMsg(null);
    const res = await fetch(`/api/admin/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      setError(json?.error?.message ?? "Failed to update profile");
      return;
    }
    setMsg("Profile updated.");
    await load();
  }

  async function deleteClientAccount(clientId: string, expectedEmail: string) {
    if (
      !window.confirm(
        "Delete this client permanently? Removes credit ledger entries and all orders. Past bookings stay in the calendar but unlink from this account.",
      )
    ) {
      return;
    }
    const typed = window.prompt(
      `Type their email exactly to confirm:\n${expectedEmail}`,
    );
    if (
      !typed ||
      typed.trim().toLowerCase() !== expectedEmail.trim().toLowerCase()
    ) {
      setError("Deletion cancelled — email did not match.");
      return;
    }
    setError(null);
    setMsg(null);
    const res = await fetch(`/api/admin/clients/${clientId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmEmail: typed.trim() }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      setError(json?.error?.message ?? "Failed to delete client");
      return;
    }
    setMsg("Client deleted.");
    onBack();
    await load();
  }

  async function setExpiryApproval(ledgerIds: string[], approved: boolean) {
    setMsg(null);
    setError(null);
    const res = await fetch(
      `/api/admin/clients/${row.client.id}/expiry-approval`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ledgerIds, approved }),
      },
    );
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      setError(json?.error?.message ?? "Failed to update expiry approval");
      return;
    }
    setMsg(
      approved
        ? "Expiry confirmed — credits drop after the expiry date."
        : "Expiry confirmation revoked.",
    );
    await load();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E8DDD4] bg-white hover:bg-[#FAF8F6] cursor-pointer"
          aria-label="Back to clients"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <h3 className="font-serif text-xl font-semibold truncate">
              {row.client.name || "—"}
            </h3>
            {row.client.studentStatus === "verified" ? (
              <button
                type="button"
                onClick={() => {
                  if (
                    !window.confirm(
                      "Remove student status for this client?",
                    )
                  ) {
                    return;
                  }
                  void updateStudentStatus(row.client.id, "none");
                }}
                className="rounded-full border border-[#B8DCC6] bg-[#E8F5EE] px-2.5 py-0.5 text-[11px] font-medium text-[#1F6B3C] hover:brightness-95 cursor-pointer"
                title="Click to remove student status"
              >
                Student
              </button>
            ) : row.client.studentStatus === "pending" ? (
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm("Verify this client as a student?")) {
                    return;
                  }
                  void updateStudentStatus(row.client.id, "verified");
                }}
                className="rounded-full border border-[#F2D3A2] bg-[#FFF7E6] px-2.5 py-0.5 text-[11px] font-medium text-[#8A5A00] hover:brightness-95 cursor-pointer"
                title="Click to verify as student"
              >
                Pending
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => adjustCredits(row.client.id)}
              className="rounded-lg border border-[#E8DDD4] bg-white px-2.5 py-1 text-xs tabular-nums text-[#444444] hover:bg-[#FAF8F6] cursor-pointer"
              title="Adjust credits"
            >
              Credits{" "}
              <span
                className={cn(
                  "font-semibold",
                  (row.balance.rawBalance ?? row.balance.balance) < 0 &&
                    "text-[#B42318]",
                )}
              >
                {row.balance.rawBalance ?? row.balance.balance}
              </span>
            </button>
          </div>
          <div className="mt-0.5 text-xs text-[#716D64] truncate">
            {[row.client.email, row.client.whatsapp].filter(Boolean).join(" · ") ||
              "No contact"}
          </div>
        </div>
      </div>

      {(row.balance.expiryAlerts?.length ?? 0) > 0 ? (
        <div className="space-y-2">
          <CreditExpiryBannerStack alerts={row.balance.expiryAlerts ?? []} />
          {(row.balance.expiryAlerts ?? []).map((a) => (
            <div
              key={a.expiresAt}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E8DDD4] px-3 py-2.5 text-sm"
            >
              <div>
                <span className="font-medium">
                  {a.credits} cr · {fmtShortDateTime(a.expiresAt)}
                </span>
                <span className="ml-2 text-xs text-[#716D64]">
                  {a.expiryApproved ? "Confirmed" : "Needs confirm"}
                </span>
              </div>
              {!a.expiryApproved ? (
                <button
                  type="button"
                  onClick={() => setExpiryApproval(a.ledgerIds, true)}
                  className="rounded-lg bg-[#DFD1C9] px-2.5 py-1.5 text-xs font-medium hover:brightness-95 cursor-pointer"
                >
                  Confirm expiry
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setExpiryApproval(a.ledgerIds, false)}
                  className="rounded-lg border border-[#E8DDD4] px-2.5 py-1.5 text-xs hover:bg-[#FAF8F6] cursor-pointer"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {pendingOrders.length > 0 ? (
        <div className="space-y-2">
          <div className="mb-2 flex items-baseline gap-2">
            <h4 className="font-serif text-lg font-semibold text-[#444444]">
              Pending orders
            </h4>
            <span className="text-sm text-[#8A5A00] tabular-nums">
              {pendingOrders.length}
            </span>
          </div>
          {pendingOrders.map((order) => (
            <div
              key={order.id}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-l-2 border-[#E8B86D] bg-[#FFFDF8] pl-3 pr-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{order.planTitle}</div>
                <div className="text-xs text-[#716D64]">
                  {order.orderRef} · RM {order.amountRm} · {order.classCount} cr ·{" "}
                  {fmtShortDateTime(order.createdAt)}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => confirmOrder(order.id)}
                  className="rounded-lg bg-[#DFD1C9] px-3 py-1.5 text-xs font-medium hover:brightness-95 cursor-pointer"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => denyOrder(order.id)}
                  className="rounded-lg border border-[#E8DDD4] bg-white px-3 py-1.5 text-xs text-[#B42318] hover:bg-[#FCE8E6]/60 cursor-pointer"
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Orders */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h4 className="font-serif text-lg font-semibold text-[#444444]">
              Orders
            </h4>
            <span className="text-sm text-[#716D64] tabular-nums">
              {row.ordersHistory.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              if (addOrderOpen) {
                setAddOrderOpen(false);
                resetAddOrderForm();
              } else {
                setAddOrderOpen(true);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8DDD4] bg-white px-3 py-1.5 text-xs font-medium hover:bg-[#FAF8F6] cursor-pointer"
          >
            <PlusIcon className="h-3.5 w-3.5" aria-hidden />
            {addOrderOpen ? "Cancel" : "Add order"}
          </button>
        </div>

        {addOrderOpen ? (
          <div className="mb-4 space-y-3 rounded-xl border border-[#E8DDD4] bg-[#FAF8F6]/60 p-3 sm:p-4">
            <p className="text-xs text-[#716D64]">
              Record a package purchase and grant remaining credits (override
              credits if needed).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-[#716D64] sm:col-span-2">
                Plan
                <select
                  value={orderPlanId}
                  onChange={(e) => setOrderPlanId(e.target.value)}
                  disabled={plansLoading}
                  className="rounded-lg border border-[#E8DDD4] bg-white px-3 py-2 text-sm text-[#444444]"
                >
                  <option value="">
                    {plansLoading ? "Loading plans…" : "Select plan"}
                  </option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.classCount} cr · RM {p.priceRm})
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-[#716D64]">
                Quantity
                <input
                  type="number"
                  min={1}
                  max={50}
                  step={1}
                  value={orderQuantity}
                  onChange={(e) =>
                    setOrderQuantity(
                      Math.max(1, Math.floor(Number(e.target.value) || 1)),
                    )
                  }
                  className="rounded-lg border border-[#E8DDD4] bg-white px-3 py-2 text-sm text-[#444444] tabular-nums"
                />
              </label>
              <label className="grid gap-1 text-xs text-[#716D64]">
                Credits
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={orderClassCount}
                  onChange={(e) => setOrderClassCount(e.target.value)}
                  className="rounded-lg border border-[#E8DDD4] bg-white px-3 py-2 text-sm text-[#444444] tabular-nums"
                />
              </label>
              <label className="grid gap-1 text-xs text-[#716D64]">
                Amount (RM)
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={orderAmountRm}
                  onChange={(e) => setOrderAmountRm(e.target.value)}
                  className="rounded-lg border border-[#E8DDD4] bg-white px-3 py-2 text-sm text-[#444444] tabular-nums"
                />
              </label>
              {orderMarkPaid ? (
                <label className="grid gap-1 text-xs text-[#716D64]">
                  Paid date
                  <input
                    type="date"
                    value={orderPaidAt}
                    onChange={(e) => setOrderPaidAt(e.target.value)}
                    className="rounded-lg border border-[#E8DDD4] bg-white px-3 py-2 text-sm text-[#444444]"
                  />
                </label>
              ) : null}
              <label className="grid gap-1 text-xs text-[#716D64] sm:col-span-2">
                Note (optional)
                <input
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder="e.g. Remaining credits from prior purchase"
                  className="rounded-lg border border-[#E8DDD4] bg-white px-3 py-2 text-sm text-[#444444]"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-[#444444]">
              <input
                type="checkbox"
                checked={orderMarkPaid}
                onChange={(e) => setOrderMarkPaid(e.target.checked)}
                className="rounded border-[#E8DDD4]"
              />
              Mark paid &amp; grant credits now
            </label>
            <button
              type="button"
              disabled={orderSaving || !orderPlanId}
              onClick={() => void submitAddOrder()}
              className="rounded-lg bg-[#DFD1C9] px-4 py-2 text-xs font-medium hover:brightness-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {orderSaving ? "Saving…" : "Add order"}
            </button>
          </div>
        ) : null}

        {row.ordersHistory.length === 0 ? (
          <p className="text-sm text-[#716D64]">No orders.</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="min-w-[720px] w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8DDD4] text-left text-[11px] text-[#716D64]">
                  <th className="pb-2 pr-3 font-medium">Date</th>
                  <th className="pb-2 pr-3 font-medium">Ref</th>
                  <th className="pb-2 pr-3 font-medium">Plan</th>
                  <th className="pb-2 pr-3 font-medium">Cr</th>
                  <th className="pb-2 pr-3 font-medium">RM</th>
                  <th className="pb-2 pr-3 font-medium">Status</th>
                  <th className="pb-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {row.ordersHistory.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-[#E8DDD4]/50 last:border-0"
                  >
                    <td className="py-2.5 pr-3 text-[#716D64] whitespace-nowrap text-xs">
                      {editingOrderId === order.id ? (
                        <input
                          type="date"
                          value={editOrderPaidAt}
                          onChange={(e) => setEditOrderPaidAt(e.target.value)}
                          className="rounded-lg border border-[#E8DDD4] bg-white px-2 py-1 text-xs text-[#444444]"
                        />
                      ) : order.paidAt ? (
                        fmtShortDateTime(order.paidAt)
                      ) : (
                        fmtShortDateTime(order.createdAt)
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs">
                      {order.orderRef}
                    </td>
                    <td className="py-2.5 pr-3 max-w-[180px]">
                      <span className="line-clamp-1">{order.planTitle}</span>
                      {(order.quantity ?? 1) > 1 ? (
                        <span className="mt-0.5 block text-[11px] text-[#716D64]">
                          ×{order.quantity}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">{order.classCount}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{order.amountRm}</td>
                    <td className="py-2.5 pr-3">
                      <OrderStatusPill status={order.status} />
                    </td>
                    <td className="py-2.5">
                      {order.status === "paid" ? (
                        editingOrderId === order.id ? (
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              disabled={editOrderSaving}
                              onClick={() => void saveOrderDate(order.id)}
                              className="rounded-lg bg-[#DFD1C9] px-2 py-1 text-[11px] font-medium hover:brightness-95 cursor-pointer disabled:opacity-40"
                            >
                              {editOrderSaving ? "…" : "Save"}
                            </button>
                            <button
                              type="button"
                              disabled={editOrderSaving}
                              onClick={() => setEditingOrderId(null)}
                              className="rounded-lg border border-[#E8DDD4] bg-white px-2 py-1 text-[11px] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEditOrderDate(order)}
                            className="text-[11px] font-medium underline text-[#A66A4A] hover:text-[#444444] cursor-pointer"
                          >
                            Edit date
                          </button>
                        )
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bookings */}
      <div>
        <div className="mb-3 flex items-baseline gap-2">
          <h4 className="font-serif text-lg font-semibold text-[#444444]">
            Bookings
          </h4>
          <span className="text-sm text-[#716D64] tabular-nums">
            {row.bookingHistory.length}
          </span>
        </div>
        {row.bookingHistory.length === 0 ? (
          <p className="text-sm text-[#716D64]">No bookings.</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="min-w-[520px] w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8DDD4] text-left text-[11px] text-[#716D64]">
                  <th className="pb-2 pr-3 font-medium">Date</th>
                  <th className="pb-2 pr-3 font-medium">Time</th>
                  <th className="pb-2 pr-3 font-medium">Class</th>
                  <th className="pb-2 pr-3 font-medium">Code</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {row.bookingHistory.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-[#E8DDD4]/50 last:border-0"
                  >
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      {fmtDateKey(b.dateKey)}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-[#716D64] text-xs">
                      {minutesToAmPmRange(b.startMin, b.endMin)}
                    </td>
                    <td className="py-2.5 pr-3 max-w-[200px]">
                      <span className="line-clamp-1">{b.itemName}</span>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs">
                      {b.code || "—"}
                    </td>
                    <td className="py-2.5">
                      <BookingStatusPill status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="border-t border-[#E8DDD4] pt-5">
        <div className="mb-3">
          <h4 className="font-serif text-lg font-semibold text-[#444444]">
            Profile
          </h4>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-xs text-[#716D64]">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-[#E8DDD4] bg-white px-3 py-2 text-sm text-[#444444]"
            />
          </label>
          <label className="grid gap-1 text-xs text-[#716D64]">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-[#E8DDD4] bg-white px-3 py-2 text-sm text-[#444444]"
            />
          </label>
          <label className="grid gap-1 text-xs text-[#716D64]">
            WhatsApp
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="rounded-lg border border-[#E8DDD4] bg-white px-3 py-2 text-sm text-[#444444]"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={!profileDirty}
            onClick={() => saveProfile(row.client.id)}
            className="rounded-lg bg-[#DFD1C9] px-4 py-2 text-xs font-medium hover:brightness-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save profile
          </button>
          <button
            type="button"
            onClick={() =>
              deleteClientAccount(row.client.id, row.client.email)
            }
            className="text-xs text-[#B42318] underline underline-offset-2 hover:opacity-80 cursor-pointer"
          >
            Delete account
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminClientsView() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [sortMode, setSortMode] = useState<"priority" | "newest">("priority");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/clients?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Failed to load clients");
      }
      setRows((json.data.clients ?? []) as ClientRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (sortMode === "newest") {
        const ca = a.client.createdAt ?? "";
        const cb = b.client.createdAt ?? "";
        if (ca !== cb) return cb.localeCompare(ca);
        return (a.client.name || "").localeCompare(b.client.name || "");
      }
      const pa = pendingCount(a);
      const pb = pendingCount(b);
      if (pa !== pb) return pb - pa;
      const ea = a.balance.expiryAlerts?.length ?? 0;
      const eb = b.balance.expiryAlerts?.length ?? 0;
      if (ea !== eb) return eb - ea;
      return (a.client.name || "").localeCompare(b.client.name || "");
    });
  }, [rows, sortMode]);

  const selected = useMemo(
    () => sortedRows.find((r) => r.client.id === selectedId) ?? null,
    [sortedRows, selectedId],
  );

  // If selected was deleted, leave detail.
  useEffect(() => {
    if (selectedId && !loading && !selected) setSelectedId(null);
  }, [selectedId, selected, loading]);

  return (
    <section
      className={cn(
        "rounded-3xl border border-[#E8DDD4] shadow-sm",
        selected ? "bg-white p-5 sm:p-6" : "bg-white/70 p-6",
      )}
    >
      {selected ? (
        <>
          {error ? <div className="mb-3 text-sm text-red-700">{error}</div> : null}
          {msg ? <div className="mb-3 text-sm text-[#716D64]">{msg}</div> : null}
          <AdminClientDetail
            row={selected}
            onBack={() => {
              setSelectedId(null);
              setMsg(null);
              setError(null);
            }}
            load={load}
            setError={setError}
            setMsg={setMsg}
          />
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-serif text-2xl font-semibold">
                Clients & Credits
              </h2>
              <div className="text-xs text-[#716D64] mt-1">
                Open a row for orders, bookings, and account actions.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setRegisterOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 transition cursor-pointer"
              >
                <PlusIcon className="h-4 w-4" aria-hidden />
                Register client
              </button>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {loading ? "Loading..." : "Reload"}
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, WhatsApp"
              className="min-w-[12rem] flex-1 rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load();
              }}
            />
            <button
              type="button"
              onClick={() => void load()}
              className="px-5 py-3 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 transition cursor-pointer"
            >
              Search
            </button>
            <div className="inline-flex rounded-full border border-[#E8DDD4] bg-white p-1 text-sm">
              <button
                type="button"
                onClick={() => setSortMode("priority")}
                className={cn(
                  "rounded-full px-3 py-2 transition cursor-pointer",
                  sortMode === "priority"
                    ? "bg-[#DFD1C9] font-medium text-[#444444]"
                    : "text-[#716D64] hover:bg-[#FAF8F6]",
                )}
              >
                Priority
              </button>
              <button
                type="button"
                onClick={() => setSortMode("newest")}
                className={cn(
                  "rounded-full px-3 py-2 transition cursor-pointer",
                  sortMode === "newest"
                    ? "bg-[#DFD1C9] font-medium text-[#444444]"
                    : "text-[#716D64] hover:bg-[#FAF8F6]",
                )}
              >
                Newest
              </button>
            </div>
          </div>

          {error ? <div className="mt-4 text-sm text-red-700">{error}</div> : null}
          {msg ? <div className="mt-4 text-sm text-[#716D64]">{msg}</div> : null}

          <div className="mt-6 overflow-x-auto rounded-2xl border border-[#E8DDD4] bg-white">
            {loading ? (
              <table className="min-w-[720px] w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-[#E8DDD4] bg-[#FAF8F6]/80 text-[11px] font-medium uppercase tracking-wide text-[#716D64]">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <th className="px-4 py-3 font-medium">Credits</th>
                    <th className="px-4 py-3 font-medium">Student</th>
                    <th className="px-4 py-3 font-medium">Pending</th>
                    <th className="px-4 py-3 font-medium">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <tr
                      key={i}
                      className="border-b border-[#E8DDD4]/60 last:border-0"
                    >
                      <td className="px-4 py-3">
                        <SkeletonLine className="w-28" />
                      </td>
                      <td className="px-4 py-3 space-y-1.5">
                        <SkeletonLine className="w-40" />
                        <SkeletonLine className="w-24" />
                      </td>
                      <td className="px-4 py-3">
                        <SkeletonLine className="w-10" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-5 w-16" rounded="rounded-full" />
                      </td>
                      <td className="px-4 py-3">
                        <SkeletonLine className="w-8" />
                      </td>
                      <td className="px-4 py-3">
                        <SkeletonLine className="w-14" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : sortedRows.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-[#716D64]">
                No clients yet.
              </div>
            ) : (
              <table className="min-w-[720px] w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-[#E8DDD4] bg-[#FAF8F6]/80 text-[11px] font-medium uppercase tracking-wide text-[#716D64]">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <th className="px-4 py-3 font-medium">Credits</th>
                    <th className="px-4 py-3 font-medium">Student</th>
                    <th className="px-4 py-3 font-medium">Pending</th>
                    <th className="px-4 py-3 font-medium">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => {
                    const pending = pendingCount(row);
                    const expiryN = row.balance.expiryAlerts?.length ?? 0;
                    const unconfirmed =
                      row.balance.expiryAlerts?.filter((a) => !a.expiryApproved)
                        .length ?? 0;
                    return (
                      <tr
                        key={row.client.id}
                        onClick={() => {
                          setSelectedId(row.client.id);
                          setMsg(null);
                          setError(null);
                        }}
                        className={cn(
                          "border-b border-[#E8DDD4]/60 last:border-0 cursor-pointer transition hover:bg-[#FAF8F6]/80",
                          pending > 0 && "bg-[#FFFDF8]",
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-[#444444]">
                            {row.client.name || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#716D64] max-w-[220px]">
                          <div className="truncate">{row.client.email || "—"}</div>
                          {row.client.whatsapp ? (
                            <div className="truncate mt-0.5">
                              {row.client.whatsapp}
                            </div>
                          ) : null}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 font-medium tabular-nums",
                            (row.balance.rawBalance ?? row.balance.balance) < 0 &&
                              "text-[#B42318]",
                          )}
                        >
                          {row.balance.rawBalance ?? row.balance.balance}
                        </td>
                        <td className="px-4 py-3">
                          <StudentPill status={row.client.studentStatus} />
                        </td>
                        <td className="px-4 py-3">
                          {pending > 0 ? (
                            <span className="inline-block rounded-full border border-[#F2D3A2] bg-[#FFF7E6] px-2 py-0.5 text-[10px] font-medium text-[#8A5A00]">
                              {pending}
                            </span>
                          ) : (
                            <span className="text-[#716D64]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {expiryN > 0 ? (
                            <span
                              className={cn(
                                "inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                unconfirmed > 0
                                  ? "border-[#F2D3A2] bg-[#FFF7E6] text-[#8A5A00]"
                                  : "border-[#B8DCC6] bg-[#E8F5EE] text-[#1F6B3C]",
                              )}
                            >
                              {unconfirmed > 0
                                ? `${unconfirmed} need confirm`
                                : `${expiryN} ok`}
                            </span>
                          ) : (
                            <span className="text-[#716D64]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <RegisterClientModal
            open={registerOpen}
            onClose={() => setRegisterOpen(false)}
            onRegistered={(clientId) => {
              void load().then(() => setSelectedId(clientId));
            }}
            setError={setError}
            setMsg={setMsg}
          />
        </>
      )}
    </section>
  );
}
