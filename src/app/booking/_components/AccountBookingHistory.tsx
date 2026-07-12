"use client";

import { useCallback, useEffect, useState } from "react";
import { DateTime } from "luxon";
import { cn } from "@/lib/cn";

type BookingRow = {
  id: string;
  code: string;
  status: "confirmed" | "cancelled" | "no_show";
  dateKey: string;
  className: string;
  startUtc: string;
  endUtc: string;
  canCancel: boolean;
  cancelBlockedReason: string | null;
};

function formatWhen(startUtc: string, endUtc: string): string {
  const start = DateTime.fromISO(startUtc).toLocal();
  const end = DateTime.fromISO(endUtc).toLocal();
  if (!start.isValid || !end.isValid) return "—";
  return `${start.toFormat("ccc, LLL d")} · ${start.toFormat("h:mm a")}–${end.toFormat("h:mm a")}`;
}

function statusLabel(status: BookingRow["status"]): string {
  if (status === "confirmed") return "Booked";
  if (status === "cancelled") return "Cancelled";
  return "No-show";
}

export function AccountBookingHistory() {
  const [items, setItems] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingCode, setCancellingCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/client/bookings?scope=history", {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Failed to load bookings");
      }
      setItems((json.data.items ?? []) as BookingRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bookings");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function requestCancel(b: BookingRow) {
    if (
      !window.confirm(
        `Cancel booking #${b.code}?\n${b.className}\n${formatWhen(b.startUtc, b.endUtc)}\n\nCancellations are allowed up to 6 hours before the session.`,
      )
    ) {
      return;
    }
    setCancellingCode(b.code);
    setError(null);
    try {
      const res = await fetch("/api/public/bookings/cancel", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: b.code }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Cancel failed");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCancellingCode(null);
    }
  }

  return (
    <section className="bg-white/70 border border-fasea-border rounded-3xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-xl font-semibold">Booking history</h2>
          <p className="mt-1 text-sm text-fasea-secondary">
            Upcoming and past sessions. You can cancel at least 6 hours before
            start.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs text-fasea-secondary underline"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mt-4 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="mt-4 text-sm text-fasea-secondary">Loading bookings…</div>
      ) : items.length === 0 ? (
        <div className="mt-4 text-sm text-fasea-secondary">
          No bookings yet. Book a class and it will show up here.
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {items.map((b) => (
            <li
              key={b.id || `${b.code}-${b.dateKey}-${b.startUtc}`}
              className="rounded-2xl border border-fasea-border bg-white/80 px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-fasea-secondary">
                      #{b.code}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap",
                        b.status === "confirmed"
                          ? "bg-[#2F6B4F] text-white"
                          : b.status === "cancelled"
                            ? "bg-[#A66A4A] text-white"
                            : "bg-[#716D64] text-white",
                      )}
                    >
                      {statusLabel(b.status)}
                    </span>
                  </div>
                  <div className="mt-1 font-medium text-fasea-tertiary">
                    {b.className || "Class"}
                  </div>
                  <div className="mt-0.5 text-sm text-fasea-secondary">
                    {formatWhen(b.startUtc, b.endUtc)}
                  </div>
                </div>
                {b.status === "confirmed" ? (
                  <div className="shrink-0 text-right">
                    <button
                      type="button"
                      disabled={!b.canCancel || cancellingCode === b.code}
                      title={b.cancelBlockedReason ?? undefined}
                      onClick={() => void requestCancel(b)}
                      className="text-xs underline text-[#A66A4A] hover:text-[#444444] disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed cursor-pointer"
                    >
                      {cancellingCode === b.code
                        ? "Cancelling…"
                        : "Request cancel"}
                    </button>
                    {!b.canCancel && b.cancelBlockedReason ? (
                      <div className="mt-1 max-w-[11rem] text-[10px] leading-snug text-fasea-secondary">
                        Within 6h of start
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
