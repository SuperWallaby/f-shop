"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { minutesToAmPmRange } from "@/app/admin/_lib/adminTime";
import { CreditExpiryBannerStack } from "@/components/CreditExpiryBannerStack";

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
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return dateKey;
  }
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
    status === "no_show" ? "No-show" : status === "confirmed" ? "Confirmed" : status === "cancelled" ? "Cancelled" : status;
  const cls =
    status === "confirmed"
      ? "bg-[#E8F5EE] text-[#1F6B3C] border-[#B8DCC6]"
      : status === "cancelled"
        ? "bg-[#F5F5F4] text-[#716D64] border-[#E8DDD4]"
        : status === "no_show"
          ? "bg-[#FFF7E6] text-[#8A5A00] border-[#F2D3A2]"
          : "bg-[#F5F5F4] text-[#716D64] border-[#E8DDD4]";
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function AdminClientRow({
  row,
  load,
  setError,
  setMsg,
}: {
  row: ClientRow;
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
    const typed = window.prompt(`Type their email exactly to confirm:\n${expectedEmail}`);
    if (!typed || typed.trim().toLowerCase() !== expectedEmail.trim().toLowerCase()) {
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
    await load();
  }

  async function setExpiryApproval(ledgerIds: string[], approved: boolean) {
    setMsg(null);
    setError(null);
    const res = await fetch(`/api/admin/clients/${row.client.id}/expiry-approval`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ledgerIds, approved }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      setError(json?.error?.message ?? "Failed to update expiry approval");
      return;
    }
    setMsg(approved ? "Expiry confirmed — credits drop after the expiry date." : "Expiry confirmation revoked.");
    await load();
  }

  return (
    <div className="rounded-3xl border border-[#E8DDD4] bg-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="font-serif text-xl font-semibold">{row.client.name}</div>
          <div className="mt-1 text-xs text-[#716D64]">
            {row.client.email} · {row.client.whatsapp}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-[#716D64]">Balance</div>
          <div className="font-serif text-2xl font-semibold">{row.balance.balance} credits</div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={row.client.studentStatus}
          onChange={(e) =>
            updateStudentStatus(row.client.id, e.target.value as ClientRow["client"]["studentStatus"])
          }
          className="rounded-full border border-[#E8DDD4] bg-white px-3 py-2 text-xs"
        >
          <option value="none">Student: none</option>
          <option value="pending">Student: pending</option>
          <option value="verified">Student: verified</option>
          <option value="rejected">Student: rejected</option>
        </select>
        <button
          type="button"
          onClick={() => adjustCredits(row.client.id)}
          className="px-3 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-xs hover:shadow-sm transition cursor-pointer"
        >
          Adjust credits
        </button>
      </div>

      <CreditExpiryBannerStack alerts={row.balance.expiryAlerts ?? []} />

      {(row.balance.expiryAlerts?.length ?? 0) > 0 ? (
        <details className="rounded-2xl border border-[#E8DDD4] bg-[#FAF8F6]/50 px-4 py-3">
          <summary className="cursor-pointer list-none text-sm font-medium text-[#444444] [&::-webkit-details-marker]:hidden flex items-center justify-between gap-2">
            <span>Credit expiry — studio actions</span>
            <span className="text-xs font-normal text-[#716D64]">{row.balance.expiryAlerts?.length}</span>
          </summary>
          <div className="mt-3 space-y-3">
            {(row.balance.expiryAlerts ?? []).map((a) => (
              <div
                key={a.expiresAt}
                className="rounded-xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">
                    {a.credits} credit{a.credits === 1 ? "" : "s"} · expiry{" "}
                    {fmtShortDateTime(a.expiresAt)}
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      a.expiryApproved
                        ? "border-[#B8DCC6] bg-[#E8F5EE] text-[#1F6B3C]"
                        : "border-[#F2D3A2] bg-[#FFF7E6] text-[#8A5A00]"
                    }`}
                  >
                    {a.expiryApproved ? "Expiry confirmed" : "Not confirmed"}
                  </span>
                </div>
                <div className="text-xs text-[#716D64]">
                  Member reminder window: {fmtShortDateTime(a.windowStart)} –{" "}
                  {fmtShortDateTime(a.windowEnd)}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {!a.expiryApproved ? (
                    <button
                      type="button"
                      onClick={() => setExpiryApproval(a.ledgerIds, true)}
                      className="px-3 py-2 rounded-full bg-[#DFD1C9] text-xs font-medium hover:brightness-95 transition cursor-pointer"
                    >
                      Confirm expiry
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setExpiryApproval(a.ledgerIds, false)}
                      className="px-3 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-xs hover:shadow-sm transition cursor-pointer"
                    >
                      Revoke expiry confirmation
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {pendingOrders.length > 0 ? (
        <div className="rounded-2xl border border-[#F2D3A2] bg-[#FFFDF8] p-4">
          <div className="text-sm font-medium text-[#444444]">
            Needs action · {pendingOrders.length} pending order
            {pendingOrders.length === 1 ? "" : "s"}
          </div>
          <div className="mt-3 space-y-2">
            {pendingOrders.map((order) => (
              <div
                key={order.id}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">{order.planTitle}</div>
                  <div className="text-xs text-[#716D64]">
                    {order.orderRef} · RM {order.amountRm} · {order.classCount} credits · requested{" "}
                    {fmtShortDateTime(order.createdAt)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => confirmOrder(order.id)}
                    className="px-3 py-2 rounded-full bg-[#DFD1C9] text-xs font-medium hover:brightness-95 transition cursor-pointer"
                  >
                    Confirm & grant
                  </button>
                  <button
                    type="button"
                    onClick={() => denyOrder(order.id)}
                    className="px-3 py-2 rounded-full border border-[#F1B3B0] bg-white text-[#B42318] text-xs font-medium hover:bg-[#FCE8E6]/80 transition cursor-pointer"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <details className="rounded-2xl border border-[#E8DDD4] bg-[#FAF8F6]/50 px-4 py-3">
        <summary className="cursor-pointer list-none text-sm font-medium text-[#444444] [&::-webkit-details-marker]:hidden flex items-center justify-between gap-2">
          <span>Package purchase history</span>
          <span className="text-xs font-normal text-[#716D64]">
            {row.ordersHistory.length} record{row.ordersHistory.length === 1 ? "" : "s"}
          </span>
        </summary>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[#E8DDD4] bg-white">
          {row.ordersHistory.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[#716D64]">No orders yet.</div>
          ) : (
            <table className="min-w-[640px] w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8DDD4] bg-[#FAF8F6]/80 text-left text-[11px] font-medium uppercase tracking-wide text-[#716D64]">
                  <th className="px-3 py-2 font-medium">Requested</th>
                  <th className="px-3 py-2 font-medium">Ref</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">Credits</th>
                  <th className="px-3 py-2 font-medium">RM</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Paid</th>
                </tr>
              </thead>
              <tbody>
                {row.ordersHistory.map((order) => (
                  <tr key={order.id} className="border-b border-[#E8DDD4]/80 last:border-0">
                    <td className="px-3 py-2.5 text-[#716D64] whitespace-nowrap">
                      {fmtShortDateTime(order.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{order.orderRef}</td>
                    <td className="px-3 py-2.5 text-[#444444] max-w-[200px]">
                      <span className="line-clamp-2">{order.planTitle}</span>
                    </td>
                    <td className="px-3 py-2.5">{order.classCount}</td>
                    <td className="px-3 py-2.5">{order.amountRm}</td>
                    <td className="px-3 py-2.5">
                      <OrderStatusPill status={order.status} />
                    </td>
                    <td className="px-3 py-2.5 text-[#716D64] text-xs whitespace-nowrap">
                      {order.paidAt ? fmtShortDateTime(order.paidAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </details>

      <details className="rounded-2xl border border-[#E8DDD4] bg-[#FAF8F6]/50 px-4 py-3">
        <summary className="cursor-pointer list-none text-sm font-medium text-[#444444] [&::-webkit-details-marker]:hidden flex items-center justify-between gap-2">
          <span>Booking history</span>
          <span className="text-xs font-normal text-[#716D64]">
            {row.bookingHistory.length} session{row.bookingHistory.length === 1 ? "" : "s"}
          </span>
        </summary>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[#E8DDD4] bg-white">
          {row.bookingHistory.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[#716D64]">No bookings yet.</div>
          ) : (
            <table className="min-w-[560px] w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8DDD4] bg-[#FAF8F6]/80 text-left text-[11px] font-medium uppercase tracking-wide text-[#716D64]">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Class</th>
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {row.bookingHistory.map((b) => (
                  <tr key={b.id} className="border-b border-[#E8DDD4]/80 last:border-0">
                    <td className="px-3 py-2.5 whitespace-nowrap text-[#444444]">
                      {fmtDateKey(b.dateKey)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-[#716D64] text-xs">
                      {minutesToAmPmRange(b.startMin, b.endMin)}
                    </td>
                    <td className="px-3 py-2.5 text-[#444444] max-w-[220px]">
                      <span className="line-clamp-2">{b.itemName}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{b.code || "—"}</td>
                    <td className="px-3 py-2.5">
                      <BookingStatusPill status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </details>

      <details className="rounded-2xl border border-[#E8DDD4] bg-[#FAF8F6]/60 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-[#716D64] select-none">
          Contact & account actions
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-xs text-[#716D64]">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border border-[#E8DDD4] bg-white px-3 py-2 text-sm text-[#444444]"
            />
          </label>
          <label className="grid gap-1 text-xs text-[#716D64]">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-[#E8DDD4] bg-white px-3 py-2 text-sm text-[#444444]"
            />
          </label>
          <label className="grid gap-1 text-xs text-[#716D64]">
            WhatsApp
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="rounded-xl border border-[#E8DDD4] bg-white px-3 py-2 text-sm text-[#444444]"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!profileDirty}
            onClick={() => saveProfile(row.client.id)}
            className="px-3 py-2 rounded-full bg-[#DFD1C9] text-xs font-medium hover:brightness-95 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save profile
          </button>
          <button
            type="button"
            onClick={() => deleteClientAccount(row.client.id, row.client.email)}
            className="px-3 py-2 rounded-full border border-[#F1B3B0] bg-[#FCE8E6] text-[#B42318] text-xs font-medium hover:brightness-95 transition cursor-pointer"
          >
            Delete account…
          </button>
        </div>
      </details>
    </div>
  );
}

export function AdminClientsView() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? "Failed to load clients");
      setRows((json.data.clients ?? []) as ClientRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Clients & Credits</h2>
          <div className="text-xs text-[#716D64] mt-1">
            Pending orders stay visible up top. Purchase and booking timelines live in the foldable
            sections below.
          </div>
        </div>
        <button
          type="button"
          onClick={load}
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
        />
        <button
          type="button"
          onClick={load}
          className="px-5 py-3 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 transition cursor-pointer"
        >
          Search
        </button>
      </div>

      {error ? <div className="mt-4 text-sm text-red-700">{error}</div> : null}
      {msg ? <div className="mt-4 text-sm text-[#716D64]">{msg}</div> : null}

      <div className="mt-6 space-y-4">
        {rows.length === 0 && !loading ? (
          <div className="text-sm text-[#716D64]">No clients yet.</div>
        ) : null}
        {rows.map((row) => (
          <AdminClientRow key={row.client.id} row={row} load={load} setError={setError} setMsg={setMsg} />
        ))}
      </div>
    </section>
  );
}
