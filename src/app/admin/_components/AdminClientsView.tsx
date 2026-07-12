"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { minutesToAmPmRange } from "@/app/admin/_lib/adminTime";
import { CreditExpiryBannerStack } from "@/components/CreditExpiryBannerStack";
import { cn } from "@/lib/cn";
import ArrowLeftIcon from "@heroicons/react/24/outline/ArrowLeftIcon";
import { Skeleton, SkeletonLine } from "./Skeleton";

type OrderHistoryEntry = {
  id: string;
  orderRef: string;
  planTitle: string;
  status: "pending" | "paid" | "cancelled";
  classCount: number;
  amountRm: number;
  createdAt: string;
  paidAt: string | null;
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
  };
  balance: {
    balance: number;
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

  const pendingOrders = useMemo(
    () => row.ordersHistory.filter((o) => o.status === "pending"),
    [row.ordersHistory],
  );

  useEffect(() => {
    setName(row.client.name);
    setEmail(row.client.email);
    setWhatsapp(row.client.whatsapp);
  }, [row.client.id, row.client.name, row.client.email, row.client.whatsapp]);

  const profileDirty =
    name.trim() !== row.client.name ||
    email.trim() !== row.client.email ||
    whatsapp.trim() !== row.client.whatsapp;

  async function confirmOrder(orderId: string) {
    setMsg(null);
    setError(null);
    const res = await fetch(`/api/admin/orders/${orderId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "Confirmed from admin clients view" }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      setError(json?.error?.message ?? "Failed to confirm order");
      return;
    }
    setMsg("Order confirmed and credits granted.");
    await load();
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
              <span className="font-semibold">{row.balance.balance}</span>
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
        <div className="mb-3 flex items-baseline gap-2">
          <h4 className="font-serif text-lg font-semibold text-[#444444]">
            Orders
          </h4>
          <span className="text-sm text-[#716D64] tabular-nums">
            {row.ordersHistory.length}
          </span>
        </div>
        {row.ordersHistory.length === 0 ? (
          <p className="text-sm text-[#716D64]">No orders.</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="min-w-[640px] w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8DDD4] text-left text-[11px] text-[#716D64]">
                  <th className="pb-2 pr-3 font-medium">Date</th>
                  <th className="pb-2 pr-3 font-medium">Ref</th>
                  <th className="pb-2 pr-3 font-medium">Plan</th>
                  <th className="pb-2 pr-3 font-medium">Cr</th>
                  <th className="pb-2 pr-3 font-medium">RM</th>
                  <th className="pb-2 pr-3 font-medium">Status</th>
                  <th className="pb-2 font-medium">Paid</th>
                </tr>
              </thead>
              <tbody>
                {row.ordersHistory.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-[#E8DDD4]/50 last:border-0"
                  >
                    <td className="py-2.5 pr-3 text-[#716D64] whitespace-nowrap text-xs">
                      {fmtShortDateTime(order.createdAt)}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs">
                      {order.orderRef}
                    </td>
                    <td className="py-2.5 pr-3 max-w-[180px]">
                      <span className="line-clamp-1">{order.planTitle}</span>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">{order.classCount}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{order.amountRm}</td>
                    <td className="py-2.5 pr-3">
                      <OrderStatusPill status={order.status} />
                    </td>
                    <td className="py-2.5 text-[#716D64] text-xs whitespace-nowrap">
                      {order.paidAt ? fmtShortDateTime(order.paidAt) : "—"}
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
      const pa = pendingCount(a);
      const pb = pendingCount(b);
      if (pa !== pb) return pb - pa;
      const ea = a.balance.expiryAlerts?.length ?? 0;
      const eb = b.balance.expiryAlerts?.length ?? 0;
      if (ea !== eb) return eb - ea;
      return (a.client.name || "").localeCompare(b.client.name || "");
    });
  }, [rows]);

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
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {loading ? "Loading..." : "Reload"}
            </button>
          </div>

          <div className="mt-5 flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, WhatsApp"
              className="flex-1 rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
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
                        <td className="px-4 py-3 font-medium tabular-nums">
                          {row.balance.balance}
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
        </>
      )}
    </section>
  );
}
