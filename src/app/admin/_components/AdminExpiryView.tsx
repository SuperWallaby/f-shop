"use client";

import { useCallback, useEffect, useState } from "react";
import { DateTime } from "luxon";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { Pill } from "./Pill";
import Link from "next/link";

type ExpiryRow = {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  type: string;
  planTitle: string;
  note: string;
  expiresDateKey: string | null;
  daysLeft: number;
  expiryApproved: boolean | null;
};

function defaultRange() {
  const now = DateTime.now().setZone(BUSINESS_TIME_ZONE);
  return {
    from: now.toISODate() ?? "",
    to: now.plus({ days: 90 }).toISODate() ?? "",
  };
}

export function AdminExpiryView() {
  const [range, setRange] = useState(defaultRange);
  const [rows, setRows] = useState<ExpiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ from: range.from, to: range.to });
      const res = await fetch(`/api/admin/credits/expiring?${qs}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Failed to load");
      }
      setRows(json.data.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <section className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-semibold">
              Plan / credit expiry
            </h2>
            <p className="mt-1 text-sm text-[#716D64]">
              Credit grants sorted by expiry date. Approve expiry from Clients
              when needed.
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

        {error ? <div className="mt-3 text-sm text-red-700">{error}</div> : null}

        <div className="mt-5 overflow-x-auto">
          {loading ? (
            <div className="text-sm text-[#716D64]">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-[#716D64]">
              No expiring credits in this range.
            </div>
          ) : (
            <table className="w-full text-sm text-left min-w-[700px]">
              <thead>
                <tr className="text-xs text-[#716D64] border-b border-[#E8DDD4]">
                  <th className="py-2 pr-3 font-medium">Expires</th>
                  <th className="py-2 pr-3 font-medium">Days left</th>
                  <th className="py-2 pr-3 font-medium">Client</th>
                  <th className="py-2 pr-3 font-medium">Credits</th>
                  <th className="py-2 pr-3 font-medium">Plan</th>
                  <th className="py-2 pr-3 font-medium">Note</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[#E8DDD4]/60">
                    <td className="py-3 pr-3 whitespace-nowrap">
                      {r.expiresDateKey}
                    </td>
                    <td className="py-3 pr-3">
                      <Pill
                        label={
                          r.daysLeft < 0
                            ? `${Math.abs(r.daysLeft)}d overdue`
                            : `${r.daysLeft}d`
                        }
                        tone={
                          r.daysLeft < 0
                            ? "warn"
                            : r.daysLeft <= 7
                              ? "warn"
                              : "muted"
                        }
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <div className="font-medium">{r.clientName}</div>
                      <div className="text-xs text-[#716D64]">
                        {r.clientEmail}
                      </div>
                    </td>
                    <td className="py-3 pr-3">{r.amount}</td>
                    <td className="py-3 pr-3">{r.planTitle || "—"}</td>
                    <td className="py-3 pr-3 max-w-[200px] truncate">
                      {r.note || "—"}
                    </td>
                    <td className="py-3">
                      {r.expiryApproved === true ? (
                        <Pill label="Approved" tone="good" />
                      ) : r.expiryApproved === false ? (
                        <Pill label="Grace" tone="muted" />
                      ) : (
                        <Pill label="—" tone="muted" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="mt-4 text-xs text-[#716D64]">
          Open{" "}
          <Link href="/admin?tab=clients" className="underline">
            Clients &amp; credits
          </Link>{" "}
          to approve expiry or adjust balances.
        </p>
      </section>
    </div>
  );
}
