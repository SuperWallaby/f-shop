"use client";

import { useCallback, useEffect, useState } from "react";

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
  };
  pendingOrders: Array<{
    id: string;
    orderRef: string;
    planTitle: string;
    classCount: number;
    amountRm: number;
    createdAt: string;
  }>;
  recentBookings: Array<{
    id: string;
    code: string;
    dateKey: string;
    status: string;
  }>;
};

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

  async function confirmOrder(orderId: string) {
    setMsg(null);
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

  async function updateStudentStatus(clientId: string, studentStatus: ClientRow["client"]["studentStatus"]) {
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

  return (
    <section className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Clients & Credits</h2>
          <div className="text-xs text-[#716D64] mt-1">
            Manage payment confirmations, credit balances, student status, and history.
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
          <div
            key={row.client.id}
            className="rounded-3xl border border-[#E8DDD4] bg-white p-5"
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="font-serif text-xl font-semibold">{row.client.name}</div>
                <div className="mt-1 text-xs text-[#716D64]">
                  {row.client.email} · {row.client.whatsapp}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[#716D64]">Balance</div>
                <div className="font-serif text-2xl font-semibold">
                  {row.balance.balance} credits
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <select
                value={row.client.studentStatus}
                onChange={(e) =>
                  updateStudentStatus(
                    row.client.id,
                    e.target.value as ClientRow["client"]["studentStatus"],
                  )
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

            {row.pendingOrders.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-[#E8DDD4] bg-[#FAF8F6] p-4">
                <div className="text-sm font-medium">Pending orders</div>
                <div className="mt-3 space-y-2">
                  {row.pendingOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm"
                    >
                      <div>
                        <div className="font-medium">{order.planTitle}</div>
                        <div className="text-xs text-[#716D64]">
                          {order.orderRef} · RM {order.amountRm} · {order.classCount} credits
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => confirmOrder(order.id)}
                        className="px-3 py-2 rounded-full bg-[#DFD1C9] text-xs font-medium hover:brightness-95 transition cursor-pointer"
                      >
                        Confirm & grant
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {row.recentBookings.length > 0 ? (
              <div className="mt-4 text-xs text-[#716D64]">
                Recent bookings:{" "}
                {row.recentBookings
                  .map((booking) => `${booking.dateKey} #${booking.code || "-"} (${booking.status})`)
                  .join(", ")}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
