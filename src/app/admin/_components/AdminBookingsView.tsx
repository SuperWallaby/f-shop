"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import EllipsisHorizontalIcon from "@heroicons/react/20/solid/EllipsisHorizontalIcon";
import { cn } from "@/lib/cn";
import { Switch } from "@/components/Switch";
import { SkeletonLine } from "./Skeleton";
import type { BookingListItem } from "../_lib/types";
import { minutesToHhmm } from "../_lib/adminTime";
import {
  AdminRescheduleBookingModal,
  type RescheduleBookingTarget,
} from "./AdminRescheduleBookingModal";
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<BookingListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 30;
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Keep latest filter values for polling (so we can set the interval only once).
  const qRef = useRef(q);
  const dateKeyRef = useRef(dateKey);
  const detachedOnlyRef = useRef(detachedOnly);
  const starredOnlyRef = useRef(starredOnly);
  const todayOnlyRef = useRef(todayOnly);
  const sortModeRef = useRef(sortMode);
  const nextCursorRef = useRef(nextCursor);
  const hasMoreRef = useRef(hasMore);
  const loadingRef = useRef(loading);
  const loadingMoreRef = useRef(loadingMore);
  useEffect(() => void (qRef.current = q), [q]);
  useEffect(() => void (dateKeyRef.current = dateKey), [dateKey]);
  useEffect(() => void (detachedOnlyRef.current = detachedOnly), [detachedOnly]);
  useEffect(() => void (starredOnlyRef.current = starredOnly), [starredOnly]);
  useEffect(() => void (todayOnlyRef.current = todayOnly), [todayOnly]);
  useEffect(() => void (sortModeRef.current = sortMode), [sortMode]);
  useEffect(() => void (nextCursorRef.current = nextCursor), [nextCursor]);
  useEffect(() => void (hasMoreRef.current = hasMore), [hasMore]);
  useEffect(() => void (loadingRef.current = loading), [loading]);
  useEffect(() => void (loadingMoreRef.current = loadingMore), [loadingMore]);

  const todayDateKey = useMemo(() => {
    return DateTime.now().setZone(BUSINESS_TIME_ZONE).toISODate() ?? "";
  }, []);

  const [rescheduleTarget, setRescheduleTarget] = useState<RescheduleBookingTarget | null>(null);

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

  const visibleItems = sortedItems;

  function buildSearchParams(opts?: {
    q?: string;
    dateKey?: string;
    detachedOnly?: boolean;
    starredOnly?: boolean;
    todayOnly?: boolean;
    sortMode?: typeof sortMode;
    cursor?: string;
  }) {
    const params = new URLSearchParams();
    const qv = (opts?.q ?? qRef.current).trim();
    const dkv = (opts?.dateKey ?? dateKeyRef.current).trim();
    const detachedV = opts?.detachedOnly ?? detachedOnlyRef.current;
    const starredV = opts?.starredOnly ?? starredOnlyRef.current;
    const todayV = opts?.todayOnly ?? todayOnlyRef.current;
    const sortV = opts?.sortMode ?? sortModeRef.current;
    if (qv) params.set("q", qv);
    if (dkv) params.set("dateKey", dkv);
    if (detachedV) params.set("detached", "true");
    if (starredV) params.set("starred", "true");
    if (todayV) params.set("todayOnly", "true");
    params.set("sort", sortV);
    params.set("limit", String(PAGE_SIZE));
    if (opts?.cursor) params.set("cursor", opts.cursor);
    return params;
  }

  async function fetchBookings(opts?: {
    q?: string;
    dateKey?: string;
    detachedOnly?: boolean;
    starredOnly?: boolean;
    todayOnly?: boolean;
    sortMode?: typeof sortMode;
    cursor?: string;
    append?: boolean;
  }) {
    const append = opts?.append ?? false;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const params = buildSearchParams(opts);
      const res = await fetch(`/api/admin/bookings/search?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok)
        throw new Error(json?.error?.message ?? "Failed to load bookings");

      const batch = (json.data.items ?? []) as BookingListItem[];
      setItems((prev) => (append ? [...prev, ...batch] : batch));
      setNextCursor(json.data.nextCursor ?? null);
      setHasMore(Boolean(json.data.hasMore));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bookings");
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }

  function search(opts?: {
    q?: string;
    dateKey?: string;
    detachedOnly?: boolean;
    starredOnly?: boolean;
    todayOnly?: boolean;
    sortMode?: typeof sortMode;
  }) {
    return fetchBookings({ ...opts, append: false });
  }

  function loadMore() {
    const cursor = nextCursorRef.current;
    if (!cursor || !hasMoreRef.current || loadingRef.current || loadingMoreRef.current) return;
    return fetchBookings({ cursor, append: true });
  }

  useEffect(() => {
    search({ sortMode });
  }, [sortMode]);

  useEffect(() => {
    if (!openMenuId) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuId(null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [openMenuId]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        loadMore()?.catch(() => null);
      },
      { rootMargin: "240px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleItems.length, hasMore]);

  // Refresh when the tab becomes visible again, and poll while open.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        search().catch(() => null);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    const pollMs = 2 * 60 * 1000;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      search().catch(() => null);
    }, pollMs);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, []);

  function openRescheduleModal(booking: BookingListItem) {
    setRescheduleTarget({
      id: booking.id,
      name: booking.name,
      email: booking.email,
      itemId: booking.itemId,
      itemName: booking.itemName,
      dateKey: booking.dateKey,
      startMin: booking.startMin,
      endMin: booking.endMin,
      slotId: booking.slotId,
    });
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
          <div className="text-xs text-[#716D64] mt-1">
            {visibleItems.length}
            {hasMore ? "+" : ""} shown
            {loadingMore ? " · loading…" : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={() => search()}
          className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
        >
          Refresh
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 min-w-[12rem] flex-1">
          <span className="text-xs text-[#716D64]">Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                search({
                  q,
                  dateKey,
                  detachedOnly,
                  starredOnly,
                  todayOnly,
                  sortMode,
                });
              }
            }}
            placeholder="Name or email"
            className="rounded-lg border border-[#E8DDD4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-[#716D64]">Date</span>
          <input
            type="date"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value)}
            className="rounded-lg border border-[#E8DDD4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-[#716D64]">Sort</span>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
            className="rounded-lg border border-[#E8DDD4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
          >
            <option value="latest_booking">Latest booking</option>
            <option value="closest_class">Closest class</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() =>
            search({
              q,
              dateKey,
              detachedOnly,
              starredOnly,
              todayOnly,
              sortMode,
            })
          }
          className="rounded-lg bg-[#DFD1C9] px-4 py-2 text-sm font-medium hover:brightness-95 cursor-pointer"
        >
          Search
        </button>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setDateKey("");
              setDetachedOnly(false);
              setStarredOnly(false);
              setTodayOnly(false);
              setSortMode("latest_booking");
              search({
                q: "",
                dateKey: "",
                detachedOnly: false,
                starredOnly: false,
                todayOnly: false,
                sortMode: "latest_booking",
              });
            }}
            className="rounded-lg border border-[#E8DDD4] bg-white px-3 py-2 text-sm hover:bg-[#FAF8F6] cursor-pointer"
          >
            Reset
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#716D64]">
        <Switch
          checked={detachedOnly}
          onCheckedChange={setDetachedOnly}
          label="Unassigned"
        />
        <Switch
          checked={starredOnly}
          onCheckedChange={setStarredOnly}
          label="Starred"
        />
        <Switch
          checked={todayOnly}
          onCheckedChange={setTodayOnly}
          label="Today"
        />
      </div>

      {error ? <div className="mt-4 text-sm text-red-700">{error}</div> : null}

      <div className="mt-5 overflow-x-auto rounded-2xl border border-[#E8DDD4] bg-white">
        {loading ? (
          <div className="px-4 py-8 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonLine key={i} className="w-full" />
            ))}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#716D64]">
            No results.
          </div>
        ) : (
          <table className="min-w-[1080px] w-full text-sm text-left">
            <thead>
              <tr className="border-b border-[#E8DDD4] bg-[#FAF8F6]/80 text-[11px] font-medium uppercase tracking-wide text-[#716D64]">
                <th className="px-3 py-2.5 font-medium w-10" />
                <th className="px-3 py-2.5 font-medium">When</th>
                <th className="px-3 py-2.5 font-medium">Code</th>
                <th className="px-3 py-2.5 font-medium">Client</th>
                <th className="px-3 py-2.5 font-medium">Class</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium min-w-[200px]">Memo</th>
                <th className="px-3 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((b) => {
                const isPast = b.dateKey < todayDateKey;
                const now = DateTime.now().setZone(BUSINESS_TIME_ZONE);
                const when = DateTime.fromISO(b.createdAt).setZone(
                  BUSINESS_TIME_ZONE,
                );
                const rel = when.isValid ? when.toRelative({ base: now }) : null;
                const statusLabel =
                  b.status === "confirmed"
                    ? "booked"
                    : b.status === "no_show"
                      ? "no-show"
                      : "cancelled";

                return (
                  <tr
                    key={b.id}
                    className={cn(
                      "border-b border-[#E8DDD4]/60 last:border-0 align-top",
                      isPast && "opacity-70",
                      b.starred && "bg-[#FAF8F6]/80",
                    )}
                  >
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setStarred(b.id, !b.starred).catch((err) =>
                            setError(
                              err instanceof Error
                                ? err.message
                                : "Failed to update star",
                            ),
                          );
                        }}
                        className={cn(
                          "inline-flex h-9 w-9 items-center justify-center rounded-full text-base cursor-pointer",
                          b.starred
                            ? "text-[#A66A4A]"
                            : "text-[#C4BBB3] hover:text-[#716D64]",
                        )}
                        aria-label={b.starred ? "Unstar" : "Star"}
                      >
                        ★
                      </button>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="font-medium text-[#444444]">
                        {b.dateKey}
                      </div>
                      <div className="text-xs text-[#716D64]">
                        {minutesToHhmm(b.startMin)}–{minutesToHhmm(b.endMin)}
                      </div>
                      {rel ? (
                        <div className="text-[10px] text-[#716D64] mt-0.5">
                          booked {rel}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs tracking-wide text-[#444444]">
                        {b.code ? `#${b.code}` : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 min-w-[140px]">
                      <div className="font-medium truncate">{b.name}</div>
                      <div className="text-xs text-[#716D64] truncate mt-0.5">
                        {b.email || "—"}
                      </div>
                      {b.whatsapp ? (
                        <div className="text-xs text-[#716D64] truncate">
                          {b.whatsapp}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 min-w-[120px]">
                      <div className="flex items-center gap-1.5">
                        {!!b.itemColor && (
                          <span
                            className="inline-block h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: b.itemColor }}
                          />
                        )}
                        <span className="truncate">{b.itemName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full border",
                            b.status === "confirmed"
                              ? "bg-[#E8F5EE] text-[#1F6B3C] border-[#B8DCC6]"
                              : b.status === "no_show"
                                ? "bg-[#FCE8E6] text-[#B42318] border-[#F1B3B0]"
                                : "bg-[#F5F5F4] text-[#716D64] border-[#E8DDD4]",
                          )}
                        >
                          {statusLabel}
                        </span>
                        {b.status === "confirmed" &&
                        b.dateKey === todayDateKey ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#F2D3A2] bg-[#FFF7E6] text-[#8A5A00]">
                            today
                          </span>
                        ) : null}
                        {b.detached ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#F1B3B0] bg-[#FCE8E6] text-[#B42318]">
                            unassigned
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 min-w-[200px] max-w-[280px]">
                      <textarea
                        defaultValue={b.adminNote ?? ""}
                        key={`${b.id}-${b.adminNote ?? ""}`}
                        rows={3}
                        className="w-full min-h-[4.5rem] resize-y rounded-lg border border-[#E8DDD4] bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
                        placeholder="Memo…"
                        onBlur={(e) => {
                          const next = e.target.value;
                          if (next === (b.adminNote ?? "")) return;
                          saveAdminNote(b.id, next).catch((err) =>
                            setError(
                              err instanceof Error
                                ? err.message
                                : "Failed to save note",
                            ),
                          );
                        }}
                      />
                    </td>
                    <td className="px-3 py-3 text-right">
                      {(b.status === "confirmed" || b.status === "cancelled") ? (
                        <div className="relative inline-flex justify-end" ref={openMenuId === b.id ? menuRef : undefined}>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuId((prev) =>
                                prev === b.id ? null : b.id,
                              )
                            }
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E8DDD4] bg-white text-[#716D64] hover:bg-[#FAF8F6] hover:text-[#444444] cursor-pointer"
                            aria-label="Booking actions"
                            aria-expanded={openMenuId === b.id}
                          >
                            <EllipsisHorizontalIcon className="h-5 w-5" aria-hidden />
                          </button>
                          {openMenuId === b.id ? (
                            <div className="absolute right-0 top-full z-50 mt-1 min-w-[11.5rem] overflow-hidden rounded-2xl border border-[#E8DDD4] bg-white py-1 shadow-[0_8px_24px_rgba(78,56,48,0.12)]">
                              {b.status === "confirmed" ? (
                                <>
                                  <button
                                    type="button"
                                    className="block w-full px-3 py-2.5 text-left text-sm text-[#444444] hover:bg-[#FAF8F6] cursor-pointer"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      openRescheduleModal(b);
                                    }}
                                  >
                                    Reschedule
                                  </button>
                                  {!b.detached ? (
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-2.5 text-left text-sm text-[#444444] hover:bg-[#FAF8F6] cursor-pointer"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        cancelBookingFromList(b.id)
                                          .then(() => search())
                                          .catch((err) =>
                                            setError(
                                              err instanceof Error
                                                ? err.message
                                                : "Failed to cancel",
                                            ),
                                          );
                                      }}
                                    >
                                      Cancel booking
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="block w-full px-3 py-2.5 text-left text-sm text-[#444444] hover:bg-[#FAF8F6] cursor-pointer"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      markNoShowFromList(b.id)
                                        .then(() => search())
                                        .catch((err) =>
                                          setError(
                                            err instanceof Error
                                              ? err.message
                                              : "Failed to mark no-show",
                                          ),
                                        );
                                    }}
                                  >
                                    Mark no-show
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2.5 text-left text-sm text-[#B42318] hover:bg-[#FCE8E6] cursor-pointer"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    deleteCancelledBookingFromList(b.id)
                                      .then(() => search())
                                      .catch((err) =>
                                        setError(
                                          err instanceof Error
                                            ? err.message
                                            : "Failed to delete",
                                        ),
                                      );
                                  }}
                                >
                                  Delete booking
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-[#716D64]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div ref={loadMoreRef} className="h-1" aria-hidden />
      {loadingMore ? (
        <div className="py-3 text-center text-xs text-[#716D64]">
          Loading more…
        </div>
      ) : null}
      {!loading && !loadingMore && visibleItems.length > 0 && !hasMore ? (
        <div className="py-2 text-center text-xs text-[#716D64]">End of list</div>
      ) : null}

      <AdminRescheduleBookingModal
        target={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onSuccess={() => search()}
      />
    </section>
  );
}

