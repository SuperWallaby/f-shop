"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { Switch } from "@/components/Switch";
import { Skeleton, SkeletonButton, SkeletonLine } from "./Skeleton";
import type { BookingListItem } from "../_lib/types";
import { minutesToAmPmRange, minutesToHhmm } from "../_lib/adminTime";

export function AdminBookingsView() {
  const [q, setQ] = useState("");
  const [dateKey, setDateKey] = useState("");
  const [detachedOnly, setDetachedOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<BookingListItem[]>([]);

  const [assignTarget, setAssignTarget] = useState<BookingListItem | null>(null);
  const [assignDateKey, setAssignDateKey] = useState<string>("");
  const [assignSlots, setAssignSlots] = useState<
    Array<{ id: string; label: string; available: number }>
  >([]);
  const [assignSlotId, setAssignSlotId] = useState<string>("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const hasActiveFilters = useMemo(() => {
    return q.trim().length > 0 || dateKey.trim().length > 0 || detachedOnly;
  }, [q, dateKey, detachedOnly]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const dk = a.dateKey.localeCompare(b.dateKey);
      if (dk !== 0) return dk;
      if (a.startMin !== b.startMin) return a.startMin - b.startMin;
      return a.endMin - b.endMin;
    });
  }, [items]);

  async function search() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (dateKey.trim()) params.set("dateKey", dateKey.trim());
      if (detachedOnly) params.set("detached", "true");
      const res = await fetch(`/api/admin/bookings/search?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok)
        throw new Error(json?.error?.message ?? "Failed to load bookings");
      setItems(json.data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAssignableSlots(dk: string) {
    const res = await fetch(`/api/admin/day?dateKey=${encodeURIComponent(dk)}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok || !json?.ok)
      throw new Error(json?.error?.message ?? "Failed to load day");
    const slots = (json.data.slots ?? []) as Array<{
      id: string;
      startMin: number;
      endMin: number;
      available: number;
      capacity: number;
      cancelled: boolean;
    }>;
    const options = slots
      .filter((s) => !s.cancelled && s.available > 0)
      .map((s) => ({
        id: s.id,
        label: `${minutesToAmPmRange(s.startMin, s.endMin)} (${s.available}/${s.capacity})`,
        available: s.available,
      }));
    setAssignSlots(options);
  }

  async function assign() {
    if (!assignTarget || !assignSlotId) return;
    setAssigning(true);
    setAssignError(null);
    try {
      const res = await fetch(
        `/api/admin/bookings/${encodeURIComponent(assignTarget.id)}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slotId: assignSlotId }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? "Failed to assign");
      setAssignTarget(null);
      setAssignSlots([]);
      setAssignSlotId("");
      setAssignDateKey("");
      await search();
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : "Failed to assign");
    } finally {
      setAssigning(false);
    }
  }

  async function cancelBookingFromList(bookingId: string) {
    const ok = window.confirm("Cancel this booking?");
    if (!ok) return;
    const res = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}/cancel`, {
      method: "POST",
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error?.message ?? "Failed to cancel");
    }
  }

  async function deleteCancelledBookingFromList(bookingId: string) {
    const ok = window.confirm("Delete this cancelled booking? This cannot be undone.");
    if (!ok) return;
    const res = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? "Failed to delete booking");
  }

  async function markNoShowFromList(bookingId: string) {
    const ok = window.confirm("Mark this booking as no-show? (This will send a notice)");
    if (!ok) return;
    const res = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}/no-show`, {
      method: "POST",
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error?.message ?? "Failed to mark no-show");
    }
  }

  async function saveAdminNote(bookingId: string, note: string) {
    const res = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminNote: note }),
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error?.message ?? "Failed to save note");
    }
    setItems((prev) => prev.map((b) => (b.id === bookingId ? { ...b, adminNote: note } : b)));
  }

  return (
    <section className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Bookings</h2>
          <div className="text-xs text-[#716D64] mt-1">Total: {sortedItems.length}</div>
        </div>
        <button
          onClick={search}
          className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition"
        >
          Refresh
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 sm:col-span-2">
          <span className="text-xs text-[#716D64]">Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") search();
            }}
            placeholder="Name or email"
            className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-[#716D64]">Date (optional)</span>
          <input
            type="date"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value)}
            className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
          />
        </label>
        <Switch checked={detachedOnly} onCheckedChange={setDetachedOnly} label="Unassigned only" />
        <button
          onClick={search}
          className="px-6 py-3 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 transition"
        >
          Search
        </button>
        {!!hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setDateKey("");
              setDetachedOnly(false);
              search();
            }}
            className="px-6 py-3 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition"
          >
            Reset
          </button>
        )}
      </div>

      {!!loading && (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-3xl border border-[#E8DDD4] bg-white/80 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonLine className="w-64" />
                  <SkeletonLine className="w-40" />
                  <SkeletonLine className="w-56" />
                  <Skeleton className="h-16 w-full rounded-2xl" />
                </div>
                <div className="shrink-0 space-y-2">
                  <SkeletonButton className="w-24" />
                  <SkeletonButton className="w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!!error && <div className="mt-4 text-sm text-red-700">{error}</div>}

      {!loading && (
        <div className="mt-6 space-y-3">
          {sortedItems.length === 0 ? (
            <div className="text-sm text-[#716D64]">No results.</div>
          ) : (
            sortedItems.map((b) => (
              <div
                key={b.id}
                className="relative rounded-3xl border border-[#E8DDD4] bg-white/80 px-5 py-4 overflow-hidden"
              >
                {!!b.itemColor && (
                  <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: b.itemColor }} />
                )}
                <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <div className="font-serif text-lg font-semibold">
                      {b.dateKey} · {minutesToHhmm(b.startMin)}–{minutesToHhmm(b.endMin)}
                    </div>

                    <div className="mt-1 flex items-baseline gap-2 flex-wrap min-w-0">
                      {!!b.code && <div className="text-xs font-mono text-[#716D64]">#{b.code}</div>}
                      <div className="text-sm font-semibold truncate">{b.name}</div>
                    </div>

                    <div className="mt-2 grid gap-1">
                      <div className="text-xs text-[#716D64] flex items-center gap-2">
                        {!!b.itemColor && (
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full border border-[#E8DDD4]"
                            style={{ backgroundColor: b.itemColor }}
                          />
                        )}
                        <span className="truncate">{b.itemName}</span>
                      </div>
                      <div className="text-xs text-[#716D64] truncate">{b.email}</div>
                      <div className="text-xs text-[#716D64] truncate">{b.whatsapp}</div>
                    </div>

                    <div className="mt-3">
                      <div className="text-xs text-[#716D64] mb-1">Memo</div>
                      <textarea
                        defaultValue={b.adminNote ?? ""}
                        rows={2}
                        className="w-full rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
                        placeholder="Internal memo…"
                        onBlur={(e) => {
                          const next = e.target.value;
                          if (next === (b.adminNote ?? "")) return;
                          saveAdminNote(b.id, next).catch((err) =>
                            setError(err instanceof Error ? err.message : "Failed to save note")
                          );
                        }}
                      />
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-3">
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={cn(
                          "text-[10px] px-2 py-1 rounded-full",
                          b.status === "confirmed"
                            ? "bg-[#DFD1C9] text-[#444444]"
                            : b.status === "no_show"
                              ? "bg-[#FCE8E6] text-[#B42318] border border-[#F1B3B0]"
                              : "bg-[#F3ECE6] text-[#716D64]"
                        )}
                      >
                        {b.status === "confirmed"
                          ? "booked"
                          : b.status === "no_show"
                            ? "no-show"
                            : "cancelled"}
                      </span>
                      {!!b.detached && (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-[#FCE8E6] text-[#B42318] border border-[#F1B3B0]">
                          unassigned
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col items-stretch gap-2 w-full">
                      {!!b.detached && (
                        <button
                          type="button"
                          onClick={() => {
                            setAssignTarget(b);
                            setAssignDateKey(b.dateKey);
                            setAssignSlotId("");
                            setAssignError(null);
                            loadAssignableSlots(b.dateKey).catch((e) =>
                              setAssignError(e instanceof Error ? e.message : "Failed")
                            );
                          }}
                          className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
                        >
                          Assign
                        </button>
                      )}

                      {!b.detached && b.status === "confirmed" && (
                        <button
                          type="button"
                          onClick={() => {
                            cancelBookingFromList(b.id)
                              .then(() => search())
                              .catch((err) =>
                                setError(err instanceof Error ? err.message : "Failed to cancel")
                              );
                          }}
                          className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-[#F3ECE6] text-sm hover:brightness-95 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}

                      {b.status === "confirmed" && (
                        <button
                          type="button"
                          onClick={() => {
                            markNoShowFromList(b.id)
                              .then(() => search())
                              .catch((err) =>
                                setError(err instanceof Error ? err.message : "Failed to mark no-show")
                              );
                          }}
                          className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
                        >
                          No show
                        </button>
                      )}

                      {b.status === "cancelled" && (
                        <button
                          type="button"
                          onClick={() => {
                            deleteCancelledBookingFromList(b.id)
                              .then(() => search())
                              .catch((err) =>
                                setError(err instanceof Error ? err.message : "Failed to delete")
                              );
                          }}
                          className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {!!assignTarget && (
        <div
          className="fixed inset-0 z-[110] px-4 py-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAssignTarget(null);
          }}
        >
          <div className="absolute inset-0 bg-black/30 pointer-events-none" />
          <div className="relative w-full max-w-xl mx-auto rounded-3xl border border-[#E8DDD4] bg-[#FAF8F6] shadow-lg max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col">
            <div className="p-6 overflow-y-auto">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-[#716D64]">Assign booking</div>
                  <div className="font-serif text-xl font-bold">{assignTarget.name}</div>
                  <div className="text-xs text-[#716D64]">{assignTarget.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setAssignTarget(null)}
                  className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition"
                >
                  Close
                </button>
              </div>

              <div className="mt-6 grid gap-3">
                <label className="grid gap-1">
                  <span className="text-xs text-[#716D64]">Date</span>
                  <input
                    type="date"
                    value={assignDateKey}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAssignDateKey(v);
                      setAssignSlotId("");
                      loadAssignableSlots(v).catch((e2) =>
                        setAssignError(e2 instanceof Error ? e2.message : "Failed")
                      );
                    }}
                    className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-[#716D64]">Session</span>
                  <select
                    value={assignSlotId}
                    onChange={(e) => setAssignSlotId(e.target.value)}
                    className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
                  >
                    <option value="">Select a session…</option>
                    {assignSlots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                {assignError ? <div className="text-sm text-red-700">{assignError}</div> : null}
                <button
                  disabled={!assignSlotId || assigning}
                  onClick={assign}
                  className="px-6 py-3 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 transition disabled:opacity-50"
                >
                  {assigning ? "Assigning…" : "Assign"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

