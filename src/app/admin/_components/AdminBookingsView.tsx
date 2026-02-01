"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import { cn } from "@/lib/cn";
import { Switch } from "@/components/Switch";
import { Skeleton, SkeletonButton, SkeletonLine } from "./Skeleton";
import type { BookingListItem } from "../_lib/types";
import { minutesToAmPmRange, minutesToHhmm } from "../_lib/adminTime";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";

export function AdminBookingsView() {
  const [q, setQ] = useState("");
  const [dateKey, setDateKey] = useState("");
  const [detachedOnly, setDetachedOnly] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const [todayOnly, setTodayOnly] = useState(false);
  const [sortMode, setSortMode] = useState<"latest_booking" | "closest_class">(
    "latest_booking"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<BookingListItem[]>([]);

  // Keep latest filter values for polling (so we can set the interval only once).
  const qRef = useRef(q);
  const dateKeyRef = useRef(dateKey);
  const detachedOnlyRef = useRef(detachedOnly);
  const starredOnlyRef = useRef(starredOnly);
  useEffect(() => void (qRef.current = q), [q]);
  useEffect(() => void (dateKeyRef.current = dateKey), [dateKey]);
  useEffect(() => void (detachedOnlyRef.current = detachedOnly), [detachedOnly]);
  useEffect(() => void (starredOnlyRef.current = starredOnly), [starredOnly]);

  const todayDateKey = useMemo(() => {
    return DateTime.now().setZone(BUSINESS_TIME_ZONE).toISODate() ?? "";
  }, []);

  const [assignTarget, setAssignTarget] = useState<BookingListItem | null>(null);
  const [assignDateKey, setAssignDateKey] = useState<string>("");
  const [assignSlots, setAssignSlots] = useState<
    Array<{ id: string; label: string; available: number }>
  >([]);
  const [assignSlotId, setAssignSlotId] = useState<string>("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const hasActiveFilters = useMemo(() => {
    return (
      q.trim().length > 0 ||
      dateKey.trim().length > 0 ||
      detachedOnly ||
      starredOnly ||
      todayOnly
    );
  }, [q, dateKey, detachedOnly, starredOnly, todayOnly]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      // Always keep starred items on top
      if (a.starred !== b.starred) return Number(b.starred) - Number(a.starred);

      if (sortMode === "latest_booking") {
        const ta = Number.isFinite(Date.parse(a.createdAt)) ? Date.parse(a.createdAt) : 0;
        const tb = Number.isFinite(Date.parse(b.createdAt)) ? Date.parse(b.createdAt) : 0;
        if (ta !== tb) return tb - ta; // newest first
      } else {
        // closest class date/time first
        const dk = a.dateKey.localeCompare(b.dateKey);
        if (dk !== 0) return dk;
        if (a.startMin !== b.startMin) return a.startMin - b.startMin;
        if (a.endMin !== b.endMin) return a.endMin - b.endMin;
      }

      // tie-breakers: class date/time, then createdAt
      const dk2 = a.dateKey.localeCompare(b.dateKey);
      if (dk2 !== 0) return dk2;
      if (a.startMin !== b.startMin) return a.startMin - b.startMin;
      if (a.endMin !== b.endMin) return a.endMin - b.endMin;
      const ta2 = Number.isFinite(Date.parse(a.createdAt)) ? Date.parse(a.createdAt) : 0;
      const tb2 = Number.isFinite(Date.parse(b.createdAt)) ? Date.parse(b.createdAt) : 0;
      return tb2 - ta2;
    });
  }, [items, sortMode]);

  const visibleItems = useMemo(() => {
    let list = sortedItems;

    // When sorting by closest upcoming class, hide past classes (before today).
    if (sortMode === "closest_class") {
      list = list.filter((b) => b.dateKey >= todayDateKey);
    }

    if (todayOnly) {
      list = list.filter((b) => b.dateKey === todayDateKey);
    }

    return list;
  }, [sortedItems, sortMode, todayDateKey, todayOnly]);

  async function search(opts?: {
    q?: string;
    dateKey?: string;
    detachedOnly?: boolean;
    starredOnly?: boolean;
  }) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const qv = (opts?.q ?? qRef.current).trim();
      const dkv = (opts?.dateKey ?? dateKeyRef.current).trim();
      const detachedV = opts?.detachedOnly ?? detachedOnlyRef.current;
      const starredV = opts?.starredOnly ?? starredOnlyRef.current;
      if (qv) params.set("q", qv);
      if (dkv) params.set("dateKey", dkv);
      if (detachedV) params.set("detached", "true");
      if (starredV) params.set("starred", "true");
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

  // Poll every 30 minutes for new bookings / changes.
  useEffect(() => {
    const pollMs = 30 * 60 * 1000;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      search().catch(() => null);
    }, pollMs);
    return () => window.clearInterval(id);
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

  async function setStarred(bookingId: string, next: boolean) {
    // optimistic UI
    setItems((prev) => prev.map((b) => (b.id === bookingId ? { ...b, starred: next } : b)));
    try {
      const res = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred: next }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? "Failed to update star");
    } catch (e) {
      // rollback on failure
      setItems((prev) => prev.map((b) => (b.id === bookingId ? { ...b, starred: !next } : b)));
      throw e;
    }
  }

  return (
    <section className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Bookings</h2>
          <div className="text-xs text-[#716D64] mt-1">Total: {visibleItems.length}</div>
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
        <Switch checked={starredOnly} onCheckedChange={setStarredOnly} label="Starred only" />
        <Switch checked={todayOnly} onCheckedChange={setTodayOnly} label="Today classes only" />
        <label className="grid gap-1 sm:col-span-2">
          <span className="text-xs text-[#716D64]">Sort</span>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
            className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
          >
            <option value="latest_booking">Latest booking</option>
            <option value="closest_class">Closest class date</option>
          </select>
        </label>
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
              setStarredOnly(false);
              setTodayOnly(false);
              setSortMode("latest_booking");
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
          {visibleItems.length === 0 ? (
            <div className="text-sm text-[#716D64]">No results.</div>
          ) : (
            visibleItems.map((b) => {
              const isPast = b.dateKey < todayDateKey;
              return (
                <div
                  key={b.id}
                  className={cn(
                    "relative rounded-3xl border border-[#E8DDD4] px-5 py-4 overflow-hidden",
                    isPast ? "bg-white/80 opacity-80" : "bg-white/80"
                  )}
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
                      <button
                        type="button"
                        onClick={() => {
                          setStarred(b.id, !b.starred).catch((err) =>
                            setError(err instanceof Error ? err.message : "Failed to update star")
                          );
                        }}
                        className={cn(
                          "inline-flex items-center justify-center h-8 w-8 rounded-full border text-sm transition cursor-pointer",
                          b.starred
                            ? "bg-[#DFD1C9] border-[#DFD1C9]"
                            : "bg-white/80 border-[#E8DDD4] hover:shadow-sm"
                        )}
                        aria-label={b.starred ? "Unstar booking" : "Star booking"}
                        title={b.starred ? "Starred" : "Star"}
                      >
                        ★
                      </button>
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

                      {b.status === "confirmed" && b.dateKey === todayDateKey ? (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-[#FFF7E6] text-[#8A5A00] border border-[#F2D3A2]">
                          오늘수업
                        </span>
                      ) : null}

                      {(() => {
                        const now = DateTime.now().setZone(BUSINESS_TIME_ZONE);
                        const when = DateTime.fromISO(b.createdAt).setZone(BUSINESS_TIME_ZONE);
                        const rel = when.toRelative({ base: now });
                        if (!rel) return null;
                        const isUnderDay = when > now.minus({ hours: 24 });
                        return (
                          <span className="text-[10px] px-2 py-1 rounded-full bg-white/70 text-[#716D64] border border-[#E8DDD4]">
                            booked{" "}
                            <span
                              className={cn(
                                "transition-colors",
                                isUnderDay ? "text-[#5B3F35] font-medium" : "text-[#716D64]"
                              )}
                            >
                              {rel}
                            </span>
                          </span>
                        );
                      })()}

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
              );
            })
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

