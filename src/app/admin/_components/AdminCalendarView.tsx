"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { Switch } from "@/components/Switch";
import { Skeleton, SkeletonLine } from "./Skeleton";
import type { CalendarDayDto } from "../_lib/types";
import {
  hhmmToAmPmLabel,
  hhmmToMinutes,
  minutesToAmPmRange,
  minutesToHhmm,
} from "../_lib/adminTime";

export function AdminCalendarView() {
  const [monthKey, setMonthKey] = useState(() =>
    DateTime.now().setZone(BUSINESS_TIME_ZONE).toFormat("yyyy-LL")
  );
  const todayDateKey = useMemo(
    () => DateTime.now().setZone(BUSINESS_TIME_ZONE).toISODate() ?? "",
    []
  );
  const monthDt = useMemo(
    () => DateTime.fromFormat(monthKey, "yyyy-LL", { zone: BUSINESS_TIME_ZONE }),
    [monthKey]
  );
  const fromDateKey = useMemo(() => monthDt.startOf("month").toISODate()!, [monthDt]);
  const toDateKey = useMemo(() => monthDt.endOf("month").toISODate()!, [monthDt]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<CalendarDayDto[]>([]);
  const [selected, setSelected] = useState<{
    dateKey: string;
    slot: CalendarDayDto["slots"][number];
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedCodeBookingId, setCopiedCodeBookingId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(() => new Set());
  const selectedSlotIdsRef = useRef<Set<string>>(new Set());
  const [dragSelecting, setDragSelecting] = useState(false);
  const dragModeRef = useRef<"add" | "remove">("add");

  async function copyBookingCode(bookingId: string, code: string) {
    const raw = code.trim();
    if (!raw) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(raw);
      } else {
        // Fallback for older browsers / non-secure contexts
        const ta = document.createElement("textarea");
        ta.value = raw;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedCodeBookingId(bookingId);
      window.setTimeout(() => setCopiedCodeBookingId(null), 1200);
    } catch {
      // ignore
    }
  }

  const [dayModalDateKey, setDayModalDateKey] = useState<string | null>(null);

  const [editStart, setEditStart] = useState<string>("09:00");
  const [editEnd, setEditEnd] = useState<string>("10:00");
  const [editItemId, setEditItemId] = useState<string>("");

  const [calendarItems, setCalendarItems] = useState<
    Array<{ id: string; name: string; capacity: number; active: boolean; color: string }>
  >([]);

  const [calendarFilterItemId, setCalendarFilterItemId] = useState<string>("");
  const [calendarBookedOnly, setCalendarBookedOnly] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    async function loadItems() {
      try {
        const res = await fetch("/api/admin/items", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && res.ok && json?.ok) {
          setCalendarItems(json.data.items ?? []);
          // Default calendar filter to the first ACTIVE class type (so "All" isn't the default).
          const list = (json.data.items ?? []) as Array<{
            id: string;
            active: boolean;
          }>;
          if (!calendarFilterItemId && Array.isArray(list) && list.length > 0) {
            const firstActive = list.find((x) => x.active)?.id ?? list[0]?.id ?? "";
            if (firstActive) setCalendarFilterItemId(firstActive);
          }
        }
      } catch {
        // ignore
      }
    }
    loadItems();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthDays = useMemo(() => {
    const start = monthDt.startOf("month");
    const end = monthDt.endOf("month");
    const list: Array<{ dateKey: string; dt: DateTime }> = [];
    let cur = start;
    while (cur <= end) {
      list.push({ dateKey: cur.toISODate()!, dt: cur });
      cur = cur.plus({ days: 1 });
    }
    return list;
  }, [monthDt]);

  const [mobileDateKey, setMobileDateKey] = useState<string>(() => {
    const now = DateTime.now().setZone(BUSINESS_TIME_ZONE);
    return now.toISODate() ?? "";
  });

  const filteredDays = useMemo(() => {
    if (!calendarFilterItemId && !calendarBookedOnly) return days;
    return days
      .map((d) => {
        const slots = (d.slots ?? []).filter((s) => {
          if (calendarFilterItemId && s.itemId !== calendarFilterItemId) return false;
          if (calendarBookedOnly) {
            const confirmed = s.bookings?.some((b) => b.status === "confirmed");
            return Boolean(confirmed);
          }
          return true;
        });
        return { ...d, slots };
      })
      .filter((d) => d.slots.length > 0);
  }, [calendarBookedOnly, calendarFilterItemId, days]);

  const dayMap = useMemo(() => {
    const m = new Map<string, CalendarDayDto>();
    for (const d of filteredDays) m.set(d.dateKey, d);
    return m;
  }, [filteredDays]);

  useEffect(() => {
    if (!selected) return;
    const s = selected.slot;
    if (calendarFilterItemId && s.itemId !== calendarFilterItemId) {
      setSelected(null);
      return;
    }
    if (calendarBookedOnly) {
      const confirmed = s.bookings?.some((b) => b.status === "confirmed");
      if (!confirmed) setSelected(null);
    }
  }, [calendarBookedOnly, calendarFilterItemId, selected]);

  const slotById = useMemo(() => {
    const m = new Map<string, CalendarDayDto["slots"][number]>();
    for (const d of days) {
      for (const s of d.slots) m.set(s.id, s);
    }
    return m;
  }, [days]);

  useEffect(() => {
    selectedSlotIdsRef.current = selectedSlotIds;
  }, [selectedSlotIds]);

  useEffect(() => {
    if (!selectMode) return;
    const onUp = () => setDragSelecting(false);
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [selectMode]);

  function syncEditorFromSelected(next: typeof selected) {
    if (!next) return;
    setEditStart(minutesToHhmm(next.slot.startMin));
    setEditEnd(minutesToHhmm(next.slot.endMin));
    setEditItemId(next.slot.itemId ?? "");
    setActionError(null);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/calendar?fromDateKey=${encodeURIComponent(fromDateKey)}&toDateKey=${encodeURIComponent(
            toDateKey
          )}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error?.message ?? "Failed to load calendar");
        }
        if (!cancelled) setDays(json.data.days ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load calendar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [fromDateKey, toDateKey]);

  useEffect(() => {
    const now = DateTime.now().setZone(BUSINESS_TIME_ZONE);
    const inMonth = now.toFormat("yyyy-LL") === monthKey;
    setMobileDateKey(inMonth ? now.toISODate()! : fromDateKey);
  }, [monthKey, fromDateKey]);

  useEffect(() => {
    // Make "today" actually feel like the default by scrolling it into view.
    // On mobile, the day chips render after the first paint (and sometimes while loading),
    // so we retry a few frames until the element exists.
    let cancelled = false;
    let tries = 0;
    const maxTries = 12;

    const tick = () => {
      if (cancelled) return;
      const el = document.getElementById(`mobile-day-${mobileDateKey}`);
      if (el) {
        el.scrollIntoView({
          inline: "center",
          block: "nearest",
          behavior: "smooth",
        });
        return;
      }
      tries++;
      if (tries < maxTries) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
    return () => {
      cancelled = true;
    };
  }, [mobileDateKey, loading]);

  async function reloadMonth() {
    const res2 = await fetch(
      `/api/admin/calendar?fromDateKey=${encodeURIComponent(fromDateKey)}&toDateKey=${encodeURIComponent(
        toDateKey
      )}`,
      { cache: "no-store" }
    );
    const json2 = await res2.json();
    if (!res2.ok || !json2?.ok) {
      throw new Error(json2?.error?.message ?? "Failed to reload calendar");
    }
    setDays(json2.data.days ?? []);
  }

  function clearSelection() {
    setSelectedSlotIds(new Set());
  }

  async function deleteSelectedSlots() {
    const ids = Array.from(selectedSlotIdsRef.current.values());
    if (ids.length === 0) return;
    const ok = window.confirm(`Delete ${ids.length} sessions? Bookings will become unassigned.`);
    if (!ok) return;
    setSaving(true);
    setActionError(null);
    try {
      for (const slotId of ids) {
        const slot = slotById.get(slotId);
        if (!slot) continue;
        if (!slot.cancelled) {
          const r1 = await fetch(`/api/admin/slots/${encodeURIComponent(slotId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cancelled: true }),
          });
          const j1 = (await r1.json().catch(() => null)) as {
            ok?: boolean;
            error?: { message?: unknown };
          } | null;
          if (!r1.ok || !j1?.ok)
            throw new Error(String(j1?.error?.message ?? "Failed to cancel slot"));
        }
        const r2 = await fetch(`/api/admin/slots/${encodeURIComponent(slotId)}/delete`, {
          method: "POST",
        });
        const j2 = (await r2.json().catch(() => null)) as {
          ok?: boolean;
          error?: { message?: unknown };
        } | null;
        if (!r2.ok || !j2?.ok)
          throw new Error(String(j2?.error?.message ?? "Failed to delete slot"));
      }
      await reloadMonth();
      clearSelection();
      setSelectMode(false);
      if (selected && ids.includes(selected.slot.id)) setSelected(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function patchSlot(slotId: string, patch: Record<string, unknown>) {
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/slots/${encodeURIComponent(slotId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Failed to update slot");
      }

      // Reload month
      const res2 = await fetch(
        `/api/admin/calendar?fromDateKey=${encodeURIComponent(fromDateKey)}&toDateKey=${encodeURIComponent(
          toDateKey
        )}`,
        { cache: "no-store" }
      );
      const json2 = await res2.json();
      if (!res2.ok || !json2?.ok) {
        throw new Error(json2?.error?.message ?? "Failed to reload calendar");
      }
      setDays(json2.data.days ?? []);

      // Keep modal open and refresh selected slot from updated data
      const updatedDay = (json2.data.days ?? []).find((d: CalendarDayDto) => d.dateKey === selected?.dateKey);
      const updatedSlot = updatedDay?.slots?.find((s: CalendarDayDto["slots"][number]) => s.id === slotId) ?? null;
      if (updatedSlot && selected) {
        const nextSel = { dateKey: selected.dateKey, slot: updatedSlot };
        setSelected(nextSel);
        syncEditorFromSelected(nextSel);
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSlot(slotId: string) {
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/slots/${encodeURIComponent(slotId)}/delete`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? "Failed to delete slot");

      // Reload month
      const res2 = await fetch(
        `/api/admin/calendar?fromDateKey=${encodeURIComponent(fromDateKey)}&toDateKey=${encodeURIComponent(
          toDateKey
        )}`,
        { cache: "no-store" }
      );
      const json2 = await res2.json();
      if (!res2.ok || !json2?.ok) {
        throw new Error(json2?.error?.message ?? "Failed to reload calendar");
      }
      setDays(json2.data.days ?? []);
      setSelected(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function cancelBooking(bookingId: string) {
    const ok = window.confirm("Cancel this booking? (This will send a notice)");
    if (!ok) return;
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}/cancel`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Failed to cancel booking");
      }

      // Reload month (same as patchSlot)
      const res2 = await fetch(
        `/api/admin/calendar?fromDateKey=${encodeURIComponent(fromDateKey)}&toDateKey=${encodeURIComponent(
          toDateKey
        )}`,
        { cache: "no-store" }
      );
      const json2 = await res2.json();
      if (!res2.ok || !json2?.ok) {
        throw new Error(json2?.error?.message ?? "Failed to reload calendar");
      }
      setDays(json2.data.days ?? []);

      if (selected) {
        const updatedDay = (json2.data.days ?? []).find((d: CalendarDayDto) => d.dateKey === selected.dateKey);
        const updatedSlot =
          updatedDay?.slots?.find((s: CalendarDayDto["slots"][number]) => s.id === selected.slot.id) ?? null;
        if (updatedSlot) {
          const nextSel = { dateKey: selected.dateKey, slot: updatedSlot };
          setSelected(nextSel);
          syncEditorFromSelected(nextSel);
        }
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function markNoShow(bookingId: string) {
    const ok = window.confirm("Mark this booking as no-show? (This will send a notice)");
    if (!ok) return;
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/admin/bookings/${encodeURIComponent(bookingId)}/no-show`,
        { method: "POST", cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Failed to mark no-show");
      }

      // Reload month and refresh selected slot
      const res2 = await fetch(
        `/api/admin/calendar?fromDateKey=${encodeURIComponent(fromDateKey)}&toDateKey=${encodeURIComponent(
          toDateKey
        )}`,
        { cache: "no-store" }
      );
      const json2 = await res2.json();
      if (!res2.ok || !json2?.ok) {
        throw new Error(json2?.error?.message ?? "Failed to reload calendar");
      }
      setDays(json2.data.days ?? []);

      if (selected) {
        const updatedDay = (json2.data.days ?? []).find(
          (d: CalendarDayDto) => d.dateKey === selected.dateKey
        );
        const updatedSlot =
          updatedDay?.slots?.find(
            (s: CalendarDayDto["slots"][number]) => s.id === selected.slot.id
          ) ?? null;
        if (updatedSlot) {
          const nextSel = { dateKey: selected.dateKey, slot: updatedSlot };
          setSelected(nextSel);
          syncEditorFromSelected(nextSel);
        }
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const gridDays = useMemo(() => {
    const start = monthDt.startOf("month");
    const end = monthDt.endOf("month");

    // Luxon weekday: 1=Mon..7=Sun. We want Sunday-start calendar.
    const startWeekday = start.weekday === 7 ? 0 : start.weekday; // 0..6
    const offset = startWeekday; // how many blanks before day 1

    const list: Array<{ kind: "blank" } | { kind: "day"; dateKey: string; dt: DateTime }> = [];
    for (let i = 0; i < offset; i++) list.push({ kind: "blank" });

    let cur = start;
    while (cur <= end) {
      list.push({ kind: "day", dateKey: cur.toISODate()!, dt: cur });
      cur = cur.plus({ days: 1 });
    }
    return list;
  }, [monthDt]);

  return (
    <section className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Calendar</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={calendarFilterItemId}
            onChange={(e) => setCalendarFilterItemId(e.target.value)}
            className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9] cursor-pointer"
          >
            <option value="">All class types</option>
            {calendarItems
              .slice()
              .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
              .map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
          </select>
          <Switch checked={calendarBookedOnly} onCheckedChange={setCalendarBookedOnly} label="Booked only" />
          <button
            type="button"
            onClick={() => {
              setSelectMode((v) => !v);
              setDragSelecting(false);
              clearSelection();
            }}
            className={cn(
              "px-4 py-2 rounded-full border text-sm hover:shadow-sm transition cursor-pointer",
              selectMode ? "bg-[#DFD1C9] border-[#DFD1C9]" : "bg-white/80 border-[#E8DDD4]"
            )}
          >
            {selectMode ? "Selecting…" : "Select & delete"}
          </button>
          {selectMode ? (
            <>
              <div className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm">
                {selectedSlotIds.size} selected
              </div>
              <button
                type="button"
                disabled={saving || selectedSlotIds.size === 0}
                onClick={() => deleteSelectedSlots()}
                className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-[#F3ECE6] text-sm hover:brightness-95 transition cursor-pointer disabled:opacity-50"
              >
                {saving ? "Deleting…" : "Delete selected"}
              </button>
              <button
                type="button"
                onClick={() => clearSelection()}
                className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
              >
                Clear
              </button>
            </>
          ) : null}
          <button
            onClick={() => setMonthKey(monthDt.minus({ months: 1 }).toFormat("yyyy-LL"))}
            className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
          >
            Prev
          </button>
          <div className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm">
            {monthDt.toFormat("LLLL yyyy")}
          </div>
          <button
            onClick={() => setMonthKey(monthDt.plus({ months: 1 }).toFormat("yyyy-LL"))}
            className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>

      {!!loading && (
        <div className="mt-6 space-y-4">
          {/* Mobile skeleton */}
          <div className="md:hidden">
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="shrink-0 w-[89px] rounded-2xl border border-[#E8DDD4] bg-white/80 px-3 py-3"
                >
                  <SkeletonLine className="w-10" />
                  <div className="mt-2">
                    <SkeletonLine className="w-8 h-5" />
                  </div>
                  <div className="mt-2">
                    <SkeletonLine className="w-12" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-3xl border border-[#E8DDD4] bg-white/80 p-5">
              <SkeletonLine className="w-32" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[92px] w-full rounded-3xl" />
                ))}
              </div>
            </div>
          </div>

          {/* Desktop skeleton */}
          <div className="hidden md:grid grid-cols-7 gap-3">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-xs font-semibold text-[#716D64] px-2">
                {d}
              </div>
            ))}
            {Array.from({ length: 42 }).map((_, i) => (
              <div key={i} className="min-h-[220px] rounded-2xl border border-[#E8DDD4] bg-white/80 p-2">
                <div className="flex items-center justify-between">
                  <SkeletonLine className="w-6" />
                </div>
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {!!error && <div className="mt-4 text-sm text-red-700">{error}</div>}
      {!!actionError && <div className="mt-4 text-sm text-red-700">{actionError}</div>}

      {/* Mobile: horizontal day strip + selected day detail */}
      <div className="md:hidden mt-6">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
          {monthDays.map((d) => {
            const slots = dayMap.get(d.dateKey)?.slots ?? [];
            const hasSlots = slots.length > 0;
            const bookingCount = slots.reduce(
              (acc, s) => acc + s.bookings.filter((b) => b.status === "confirmed").length,
              0
            );
            const selectedDay = d.dateKey === mobileDateKey;
            const isToday = d.dateKey === todayDateKey;
            return (
              <button
                key={d.dateKey}
                id={`mobile-day-${d.dateKey}`}
                type="button"
                onClick={() => setMobileDateKey(d.dateKey)}
                className={cn(
                  "shrink-0 w-[89px] rounded-2xl border px-3 py-3 text-left transition cursor-pointer",
                  selectedDay
                    ? "bg-[#DFD1C9] border-[#DFD1C9]"
                    : cn(
                        "bg-white/80 border-[#E8DDD4] hover:shadow-sm",
                        isToday ? "ring-2 ring-[#A66A4A] ring-offset-2 ring-offset-[#FAF8F6]" : ""
                      )
                )}
              >
                <div className="text-[10px] text-[#716D64] flex items-center gap-2">
                  <span>{d.dt.toFormat("ccc")}</span>
                  {isToday ? (
                    <span className="inline-flex items-center justify-center text-[9px] px-1.5 py-0.5 rounded-full bg-[#A66A4A] text-white">
                      Today
                    </span>
                  ) : null}
                </div>
                <div className="text-lg font-semibold leading-none mt-1">{d.dt.day}</div>
                <div className="mt-2 text-[10px] text-[#716D64]">{hasSlots ? `${bookingCount} bookings` : "—"}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-3xl border border-[#E8DDD4] bg-white/80 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <div className="font-serif text-xl font-semibold">{mobileDateKey}</div>
          </div>

          <div className="mt-4 space-y-3">
            {(dayMap.get(mobileDateKey)?.slots ?? []).length === 0 ? (
              <div className="text-sm text-[#716D64]">No sessions</div>
            ) : (
              (dayMap.get(mobileDateKey)?.slots ?? []).map((s) => {
                const confirmed = s.bookings.filter((b) => b.status === "confirmed");
                const isSelected = selectedSlotIds.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onMouseDown={(e) => {
                      if (!selectMode) return;
                      if (e.button !== 0) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const already = selectedSlotIdsRef.current.has(s.id);
                      dragModeRef.current = already ? "remove" : "add";
                      setDragSelecting(true);
                      setSelectedSlotIds((prev) => {
                        const next = new Set(prev);
                        if (dragModeRef.current === "add") next.add(s.id);
                        else next.delete(s.id);
                        return next;
                      });
                    }}
                    onMouseEnter={() => {
                      if (!selectMode || !dragSelecting) return;
                      setSelectedSlotIds((prev) => {
                        const next = new Set(prev);
                        if (dragModeRef.current === "add") next.add(s.id);
                        else next.delete(s.id);
                        return next;
                      });
                    }}
                    onClick={() => {
                      if (selectMode) return;
                      const nextSel = { dateKey: mobileDateKey, slot: s };
                      setSelected(nextSel);
                      syncEditorFromSelected(nextSel);
                    }}
                    className={cn(
                      "w-full text-left rounded-3xl border bg-white px-4 py-4 hover:shadow-sm transition cursor-pointer",
                      isSelected ? "ring-2 ring-[#A66A4A] border-[#A66A4A]" : "border-[#E8DDD4]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">{minutesToAmPmRange(s.startMin, s.endMin)}</div>
                      {s.cancelled ? <div className="text-xs text-[#B42318] font-semibold">Cancelled</div> : null}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div
                        className={cn(
                          "text-xs",
                          confirmed.length > 0 ? "text-[#444444] font-semibold" : "text-[#716D64]"
                        )}
                      >
                        {confirmed.length} bookings
                      </div>
                    </div>
                    {!!s.notes && <div className="text-xs text-[#716D64] mt-2">{s.notes}</div>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Desktop: monthly grid */}
      <div className="hidden md:grid mt-6 grid-cols-7 gap-3">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-xs font-semibold text-[#716D64] px-2">
            {d}
          </div>
        ))}
        {gridDays.map((item, idx) => {
          if (item.kind === "blank") {
            return <div key={`b-${idx}`} className="min-h-[220px]" />;
          }
          const isToday = item.dateKey === todayDateKey;
          const day = dayMap.get(item.dateKey);
          const slots = day?.slots ?? [];
          const visibleSlots = slots.slice(0, 3);
          const extraSlotsCount = Math.max(0, slots.length - visibleSlots.length);
          return (
            <div
              key={item.dateKey}
              className={cn(
                "min-h-[220px] rounded-2xl border bg-white/80 p-2",
                isToday
                  ? "border-[#A66A4A] ring-2 ring-[#A66A4A] ring-offset-2 ring-offset-[#FAF8F6]"
                  : "border-[#E8DDD4]"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold flex items-center gap-2">
                  <span>{item.dt.day}</span>
                  {isToday ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#A66A4A] text-white">
                      Today
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 space-y-1">
                {slots.length === 0 ? (
                  <div className="text-xs text-[#716D64]">No sessions</div>
                ) : (
                  <>
                    {visibleSlots.map((s) => {
                      const confirmed = s.bookings.filter((b) => b.status === "confirmed");
                      const tone = s.cancelled ? "bg-[#F3ECE6] text-[#716D64]" : "text-[#444444]";
                      const isSelected = selectedSlotIds.has(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onMouseDown={(e) => {
                            if (!selectMode) return;
                            if (e.button !== 0) return;
                            e.preventDefault();
                            e.stopPropagation();
                            const already = selectedSlotIdsRef.current.has(s.id);
                            dragModeRef.current = already ? "remove" : "add";
                            setDragSelecting(true);
                            setSelectedSlotIds((prev) => {
                              const next = new Set(prev);
                              if (dragModeRef.current === "add") next.add(s.id);
                              else next.delete(s.id);
                              return next;
                            });
                          }}
                          onMouseEnter={() => {
                            if (!selectMode || !dragSelecting) return;
                            setSelectedSlotIds((prev) => {
                              const next = new Set(prev);
                              if (dragModeRef.current === "add") next.add(s.id);
                              else next.delete(s.id);
                              return next;
                            });
                          }}
                          onClick={() => {
                            if (selectMode) return;
                            const nextSel = { dateKey: item.dateKey, slot: s };
                            setSelected(nextSel);
                            syncEditorFromSelected(nextSel);
                          }}
                          style={!s.cancelled && s.itemColor ? { backgroundColor: s.itemColor } : undefined}
                          className={cn(
                            "w-full text-left rounded-xl px-2.5 py-2 transition cursor-pointer",
                            tone,
                            "hover:brightness-95",
                            isSelected ? "ring-2 ring-[#A66A4A]" : ""
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className={s.cancelled ? "line-through opacity-70" : ""}>
                              <div className="text-[11px] font-semibold">
                                {minutesToAmPmRange(s.startMin, s.endMin)}
                              </div>
                              {s.notes ? (
                                <div className="text-[10px] opacity-90 truncate">{s.notes}</div>
                              ) : (
                                <div className="text-[10px] opacity-80">No notes</div>
                              )}
                            </div>
                            {s.cancelled ? (
                              <div className="text-[10px] font-semibold text-[#B42318]">Cancelled</div>
                            ) : null}
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "text-[10px]",
                                confirmed.length > 0 ? "text-[#444444] font-semibold" : "text-[#716D64]"
                              )}
                            >
                              {confirmed.length} bookings
                            </span>
                          </div>
                        </button>
                      );
                    })}
                    {!!extraSlotsCount && (
                      <button
                        type="button"
                        onClick={() => setDayModalDateKey(item.dateKey)}
                        className="text-[11px] text-[#7A4B3A] underline px-2 hover:text-[#5E3A2D] cursor-pointer text-left"
                      >
                        +{extraSlotsCount} more
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Day modal (from "+N more") */}
      {dayModalDateKey ? (
        <div
          className="fixed inset-0 z-[105] px-4 py-6 overflow-y-auto flex items-start md:items-center justify-center"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDayModalDateKey(null);
          }}
        >
          <div className="absolute inset-0 bg-black/30 pointer-events-none" />
          <div className="relative w-full max-w-3xl mx-auto rounded-3xl border border-[#E8DDD4] bg-[#FAF8F6] shadow-lg overflow-hidden flex flex-col">
            <div className="p-6 overflow-y-auto max-h-[calc(100vh-3rem)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-[#716D64]">Sessions</div>
                  <h3 className="font-serif text-2xl font-bold">{dayModalDateKey}</h3>
                  <div className="mt-2 text-sm text-[#716D64]">Click a session to open details.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setDayModalDateKey(null)}
                  className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {(dayMap.get(dayModalDateKey)?.slots ?? []).length === 0 ? (
                  <div className="text-sm text-[#716D64]">No sessions.</div>
                ) : (
                  (dayMap.get(dayModalDateKey)?.slots ?? []).map((s) => {
                    const confirmed = s.bookings.filter((b) => b.status === "confirmed");
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          const nextSel = { dateKey: dayModalDateKey, slot: s };
                          setSelected(nextSel);
                          syncEditorFromSelected(nextSel);
                          setDayModalDateKey(null);
                        }}
                        style={!s.cancelled && s.itemColor ? { backgroundColor: s.itemColor } : undefined}
                        className={cn(
                          "w-full text-left rounded-3xl border border-[#E8DDD4] bg-white px-5 py-4 hover:brightness-95 transition cursor-pointer"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className={cn("text-sm font-semibold", s.cancelled ? "line-through opacity-70" : "")}>
                            {minutesToAmPmRange(s.startMin, s.endMin)}
                          </div>
                          {s.cancelled ? (
                            <div className="text-xs font-semibold text-[#B42318]">Cancelled</div>
                          ) : null}
                        </div>
                        <div className="mt-2 text-xs text-[#716D64]">
                          {calendarItems.find((it) => it.id === s.itemId)?.name ?? ""}
                        </div>
                        <div className="mt-1 text-xs">
                          <span
                            className={cn(
                              confirmed.length > 0 ? "text-[#444444] font-semibold" : "text-[#716D64]"
                            )}
                          >
                            {confirmed.length} bookings
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal */}
      {selected ? (
        <div
          className="fixed inset-0 z-[100] px-4 py-6 overflow-y-auto flex items-start md:items-center justify-center"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <div className="absolute inset-0 bg-black/30 pointer-events-none" />
          <div className="relative w-full max-w-2xl mx-auto rounded-3xl border border-[#E8DDD4] bg-[#FAF8F6] shadow-lg max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col">
            <div className="p-6 overflow-y-auto">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-[#716D64]">{selected.dateKey}</div>
                  <h3 className="font-serif text-2xl font-bold">
                    {minutesToAmPmRange(selected.slot.startMin, selected.slot.endMin)}
                  </h3>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <div className="text-sm text-[#716D64]">
                      {selected.slot.bookedCount}/{selected.slot.capacity} booked
                    </div>
                    {selected.slot.cancelled ? (
                      <div className="text-xs font-semibold text-[#B42318]">Cancelled</div>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={saving || selected.slot.cancelled}
                    onClick={() => {
                      const ok = window.confirm("Cancel this session? Bookings will become unassigned.");
                      if (!ok) return;
                      patchSlot(selected.slot.id, { cancelled: true });
                    }}
                    className="px-4 py-2 rounded-full border border-[#F1B3B0] bg-[#FCE8E6] text-[#B42318] text-sm hover:brightness-95 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>

              {actionError ? <div className="mt-4 text-sm text-red-700">{actionError}</div> : null}

              <div className="mt-6 grid gap-4  md:grid-cols-2">
                <div className="rounded-3xl  border border-[#E8DDD4] bg-white/70 p-5">
                  <div className="font-serif font-semibold mb-3">Edit slot</div>
                  <div className="grid gap-3">
                    <label className="grid gap-1">
                      <span className="text-xs text-[#716D64]">Start (24h)</span>
                      <input
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
                      />
                      <span className="text-[11px] text-[#716D64]">{hhmmToAmPmLabel(editStart) ?? ""}</span>
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-[#716D64]">End (24h)</span>
                      <input
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                        className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
                      />
                      <span className="text-[11px] text-[#716D64]">{hhmmToAmPmLabel(editEnd) ?? ""}</span>
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-[#716D64]">Class Type</span>
                      <select
                        value={editItemId}
                        onChange={(e) => setEditItemId(e.target.value)}
                        className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
                      >
                        <option value="">Select…</option>
                        {calendarItems.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} (cap {it.capacity})
                            {it.active ? "" : " [inactive]"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        const startMin = hhmmToMinutes(editStart);
                        const endMin = hhmmToMinutes(editEnd);
                        if (startMin === null || endMin === null) {
                          setActionError("Invalid time format");
                          return;
                        }
                        if (endMin <= startMin) {
                          setActionError("End must be after start");
                          return;
                        }
                        if (!editItemId) {
                          setActionError("Select a class type");
                          return;
                        }
                        patchSlot(selected.slot.id, {
                          itemId: editItemId,
                          startMin,
                          endMin,
                        });
                      }}
                      className="mt-2 px-6 py-3 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 transition disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>

                    {selected.slot.cancelled ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          const ok = window.confirm(
                            "Delete this cancelled session? Bookings will become unassigned."
                          );
                          if (ok) deleteSlot(selected.slot.id);
                        }}
                        className="mt-2 px-6 py-3 rounded-full bg-[#F3ECE6] text-sm font-medium hover:brightness-95 transition disabled:opacity-50"
                      >
                        {saving ? "Deleting…" : "Delete session"}
                      </button>
                    ) : (
                      <div className="mt-3 text-xs text-[#716D64]">
                        Delete is available only after the session is cancelled.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-[#E8DDD4] bg-white/70 p-5">
                  <div className="font-serif font-semibold mb-3">Bookings</div>
                  <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
                    {selected.slot.bookings.length === 0 ? (
                      <div className="text-sm text-[#716D64]">No bookings.</div>
                    ) : (
                      selected.slot.bookings.map((b) => (
                        <div
                          key={b.id}
                          className="rounded-2xl border border-[#E8DDD4] px-4 py-3"
                          style={{
                            backgroundColor: selected.slot.itemColor
                              ? selected.slot.itemColor
                              : "rgba(255,255,255,0.9)",
                            opacity: b.status === "cancelled" ? 0.7 : 1,
                          }}
                        >
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                              {!!b.code && (
                                <div className="flex items-baseline gap-2">
                                  <button
                                    type="button"
                                    onClick={() => copyBookingCode(b.id, b.code)}
                                    className="text-xs font-mono text-[#716D64] hover:text-[#444444] hover:underline underline-offset-2"
                                    title="Click to copy booking code"
                                  >
                                    #{b.code}
                                  </button>
                                  {copiedCodeBookingId === b.id ? (
                                    <span className="text-[10px] text-[#716D64]">
                                      copied
                                    </span>
                                  ) : null}
                                </div>
                              )}
                              <div className="text-sm font-medium truncate min-w-0">
                                {b.starred ? <span title="Starred">★ </span> : null}
                                {b.name}
                              </div>
                            </div>
                            <div className="text-xs text-[#716D64] truncate">{b.email}</div>
                            <div className="text-xs text-[#716D64] truncate">{b.whatsapp}</div>
                            <div className="text-[10px] text-[#716D64]">
                              {(() => {
                                const statusLabel =
                                  b.status === "confirmed"
                                    ? "booked"
                                    : b.status === "no_show"
                                      ? "no-show"
                                      : "cancelled";

                                let whenIso: string | null = null;
                                if (b.status === "cancelled" && typeof b.cancelledAt === "string") {
                                  whenIso = b.cancelledAt;
                                } else if (b.status === "no_show" && typeof b.noShowAt === "string") {
                                  whenIso = b.noShowAt;
                                } else if (typeof b.createdAt === "string") {
                                  whenIso = b.createdAt;
                                }

                                const rel =
                                  whenIso
                                    ? DateTime.fromISO(whenIso).toRelative({
                                        base: DateTime.now(),
                                      })
                                    : null;

                                return (
                                  <>
                                    {statusLabel}
                                    {rel ? ` · ${rel}` : null}
                                  </>
                                );
                              })()}
                            </div>
                            {!!b.adminNote && b.adminNote.trim().length > 0 ? (
                              <div className="mt-1 text-[10px] text-[#444444] line-clamp-2">
                                Memo: {b.adminNote.trim()}
                              </div>
                            ) : null}
                          </div>

                          {b.status === "confirmed" ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => cancelBooking(b.id)}
                                className="px-3 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-xs hover:shadow-sm transition disabled:opacity-50 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => markNoShow(b.id)}
                                className="px-3 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-xs hover:shadow-sm transition disabled:opacity-50 cursor-pointer"
                              >
                                No show
                              </button>
                            </div>
                          ) : b.status === "cancelled" ? (
                            <div className="mt-2 flex flex-col items-start gap-2">
                              <button
                                type="button"
                                disabled={saving}
                                onClick={async () => {
                                  const ok = window.confirm(
                                    "Delete this cancelled booking? This cannot be undone."
                                  );
                                  if (!ok) return;
                                  setSaving(true);
                                  setActionError(null);
                                  try {
                                    const res = await fetch(
                                      `/api/admin/bookings/${encodeURIComponent(b.id)}`,
                                      { method: "DELETE", cache: "no-store" }
                                    );
                                    const json = await res.json();
                                    if (!res.ok || !json?.ok)
                                      throw new Error(
                                        json?.error?.message ?? "Failed to delete booking"
                                      );

                                    // Reload month and refresh selected slot
                                    const res2 = await fetch(
                                      `/api/admin/calendar?fromDateKey=${encodeURIComponent(
                                        fromDateKey
                                      )}&toDateKey=${encodeURIComponent(toDateKey)}`,
                                      { cache: "no-store" }
                                    );
                                    const json2 = await res2.json();
                                    if (!res2.ok || !json2?.ok) {
                                      throw new Error(
                                        json2?.error?.message ?? "Failed to reload calendar"
                                      );
                                    }
                                    setDays(json2.data.days ?? []);
                                    const updatedDay = (json2.data.days ?? []).find(
                                      (d: CalendarDayDto) => d.dateKey === selected?.dateKey
                                    );
                                    const updatedSlot =
                                      updatedDay?.slots?.find(
                                        (s: CalendarDayDto["slots"][number]) =>
                                          s.id === selected.slot.id
                                      ) ?? null;
                                    if (updatedSlot) {
                                      const nextSel = {
                                        dateKey: selected.dateKey,
                                        slot: updatedSlot,
                                      };
                                      setSelected(nextSel);
                                      syncEditorFromSelected(nextSel);
                                    } else {
                                      setSelected(null);
                                    }
                                  } catch (e) {
                                    setActionError(e instanceof Error ? e.message : "Failed");
                                  } finally {
                                    setSaving(false);
                                  }
                                }}
                                className="px-3 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-xs hover:shadow-sm transition disabled:opacity-50 cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Unassigned bookings removed from this modal (kept in Bookings tab) */}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

