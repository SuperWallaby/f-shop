"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { minutesToAmPmRange } from "@/app/admin/_lib/adminTime";
import { normalizeHexColor } from "@/lib/itemColor";
import {
  readLastClassTypeId,
  writeLastClassTypeId,
} from "../_lib/lastClassType";
import { buildBookingDraft, writeBookingDraft } from "../_lib/bookingDraft";
import { ClassTypeGridSkeleton } from "../_components/ClassTypeGridSkeleton";

type ScheduleSlot = {
  id: string;
  itemId: string;
  itemName: string;
  itemColor: string;
  startMin: number;
  endMin: number;
  capacity: number;
  bookedCount: number;
  available: number;
};

type ScheduleDay = {
  dateKey: string;
  slots: ScheduleSlot[];
};

type ScheduleItem = {
  id: string;
  name: string;
  color: string;
};

const DAY_COLUMN_WIDTH = 120;

function spotsLabel(slot: ScheduleSlot): string {
  if (slot.capacity <= 1) {
    return slot.available > 0 ? "Open" : "Full";
  }
  return `${slot.bookedCount}/${slot.capacity} booked`;
}

function tintHexColor(hex: string, mixWithWhite = 0.35): string | null {
  const n = normalizeHexColor(hex);
  if (!n) return null;
  const raw = n.slice(1);
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const t = Math.min(1, Math.max(0, mixWithWhite));
  const rr = Math.round(r + (255 - r) * t);
  const gg = Math.round(g + (255 - g) * t);
  const bb = Math.round(b + (255 - b) * t);
  return `rgb(${rr} ${gg} ${bb})`;
}

function ScheduleSlotCard({
  slot,
  onSelect,
}: {
  slot: ScheduleSlot;
  onSelect?: () => void;
}) {
  const full = slot.available <= 0;
  const className = cn(
    "rounded-xl px-2.5 py-2 text-[#444444] w-full text-left",
    !slot.itemColor && "bg-white border border-[#E8DDD4]",
    onSelect && "cursor-pointer transition hover:brightness-[0.97]",
  );

  const content = (
    <>
      <div className="text-[11px] font-semibold">
        {minutesToAmPmRange(slot.startMin, slot.endMin)}
      </div>
      <div className="text-[10px] truncate opacity-90">{slot.itemName}</div>
      <div
        className={cn(
          "mt-1 text-[10px]",
          full ? "text-[#716D64]" : "text-[#444444] font-medium",
        )}
      >
        {spotsLabel(slot)}
      </div>
    </>
  );

  if (!onSelect) {
    return (
      <div
        style={slot.itemColor ? { backgroundColor: slot.itemColor } : undefined}
        className={className}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      style={slot.itemColor ? { backgroundColor: slot.itemColor } : undefined}
      className={className}
    >
      {content}
    </button>
  );
}

export function PublicScheduleView() {
  const router = useRouter();
  const [selectedItemId, setSelectedItemId] = useState("");
  const [monthKey, setMonthKey] = useState(() =>
    DateTime.now().setZone(BUSINESS_TIME_ZONE).toFormat("yyyy-LL"),
  );
  const todayDateKey = useMemo(
    () => DateTime.now().setZone(BUSINESS_TIME_ZONE).toISODate() ?? "",
    [],
  );
  const monthDt = useMemo(
    () =>
      DateTime.fromFormat(monthKey, "yyyy-LL", { zone: BUSINESS_TIME_ZONE }),
    [monthKey],
  );
  const fromDateKey = monthDt.startOf("month").toISODate()!;
  const toDateKey = monthDt.endOf("month").toISODate()!;

  const [itemsLoading, setItemsLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<ScheduleDay[]>([]);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [bookedOnly, setBookedOnly] = useState(false);

  function goToBooking(dateKey: string, slotId?: string) {
    if (!selectedItemId) return;
    const [y, m] = dateKey.split("-").map(Number);
    writeLastClassTypeId(selectedItemId);
    writeBookingDraft(
      buildBookingDraft({
        itemId: selectedItemId,
        dateKey,
        slotId: slotId ?? null,
        month: new Date(y, m - 1, 1),
        email: "",
        whatsapp: "",
      }),
    );
    router.push(`/booking?itemId=${encodeURIComponent(selectedItemId)}`);
  }

  function selectClass(itemId: string) {
    writeLastClassTypeId(itemId);
    setSelectedItemId(itemId);
    setDays([]);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadItems() {
      setItemsLoading(true);
      try {
        const res = await fetch("/api/public/items", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error?.message ?? "Failed to load classes");
        }
        if (!cancelled) {
          setItems(
            (json.data.items ?? []).map(
              (it: { id: string; name: string; color?: string }) => ({
                id: it.id,
                name: it.name,
                color: it.color ?? "",
              }),
            ),
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load classes");
        }
      } finally {
        if (!cancelled) setItemsLoading(false);
      }
    }
    void loadItems();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    if (selectedItemId && items.some((it) => it.id === selectedItemId)) return;

    const last = readLastClassTypeId();
    if (last && items.some((it) => it.id === last)) {
      setSelectedItemId(last);
    }
  }, [items, selectedItemId]);

  useEffect(() => {
    if (!selectedItemId) {
      setDays([]);
      return;
    }

    let cancelled = false;
    async function loadSchedule() {
      setScheduleLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          fromDateKey,
          toDateKey,
          itemId: selectedItemId,
        });
        const res = await fetch(`/api/public/schedule?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error?.message ?? "Failed to load schedule");
        }
        if (!cancelled) {
          setDays(json.data.days ?? []);
        }
      } catch (e) {
        if (!cancelled) {
          setDays([]);
          setError(e instanceof Error ? e.message : "Failed to load schedule");
        }
      } finally {
        if (!cancelled) setScheduleLoading(false);
      }
    }
    void loadSchedule();
    return () => {
      cancelled = true;
    };
  }, [fromDateKey, toDateKey, selectedItemId]);

  const selectedItem = useMemo(
    () => items.find((it) => it.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  const filteredDays = useMemo(() => {
    if (!bookedOnly) return days;
    return days
      .map((d) => ({
        ...d,
        slots: d.slots.filter((s) => s.bookedCount > 0),
      }))
      .filter((d) => d.slots.length > 0);
  }, [bookedOnly, days]);

  const dayMap = useMemo(() => {
    const m = new Map<string, ScheduleDay>();
    for (const d of filteredDays) m.set(d.dateKey, d);
    return m;
  }, [filteredDays]);

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

  const gridDays = useMemo(() => {
    const start = monthDt.startOf("month");
    const end = monthDt.endOf("month");
    const startWeekday = start.weekday === 7 ? 0 : start.weekday;
    const list: Array<
      { kind: "blank" } | { kind: "day"; dateKey: string; dt: DateTime }
    > = [];
    for (let i = 0; i < startWeekday; i++) list.push({ kind: "blank" });
    let cur = start;
    while (cur <= end) {
      list.push({ kind: "day", dateKey: cur.toISODate()!, dt: cur });
      cur = cur.plus({ days: 1 });
    }
    return list;
  }, [monthDt]);

  function renderClassCards() {
    if (itemsLoading) {
      return <ClassTypeGridSkeleton count={5} className="grid-cols-2 md:grid-cols-5" />;
    }

    return (
      <div
        role="radiogroup"
        aria-label="Class type"
        className="grid grid-cols-2 md:grid-cols-5 gap-3 items-stretch"
      >
        {items.map((it) => {
          const selected = selectedItemId === it.id;
          const tinted = tintHexColor(it.color, 0.38);
          return (
            <button
              key={it.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => selectClass(it.id)}
              style={
                !selected && tinted ? { backgroundColor: tinted } : undefined
              }
              className={cn(
                "rounded-3xl border px-5 py-4 pr-10 text-left transition cursor-pointer h-full relative",
                selected
                  ? "bg-white border-[#E8DDD4] ring-2 ring-[#A66A4A] ring-offset-2 ring-offset-[#FAF8F6] shadow-sm"
                  : "bg-white border-[#E8DDD4] hover:shadow-sm",
              )}
            >
              {!!it.color && (
                <span
                  className="absolute top-3 right-3 h-6 w-6 rounded-full border border-black/10"
                  style={{ backgroundColor: it.color }}
                  aria-hidden
                />
              )}
              {selected ? (
                <span className="absolute top-3 right-3 z-10 h-6 w-6 rounded-full border border-[#A66A4A] bg-white/90 text-[#A66A4A] flex items-center justify-center text-sm leading-none shadow-sm">
                  ✓
                </span>
              ) : null}
              <div className="font-serif text-lg font-semibold text-[#444444]">
                {it.name}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  function renderDaySlots(dateKey: string, slots: ScheduleSlot[]) {
    if (slots.length === 0) {
      return (
        <div className="text-xs text-[#716D64] min-h-[3rem]">No sessions</div>
      );
    }
    return slots.map((s) => (
      <ScheduleSlotCard
        key={s.id}
        slot={s}
        onSelect={() => goToBooking(dateKey, s.id)}
      />
    ));
  }

  return (
    <section className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-4 sm:p-6 shadow-sm">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Class schedule</h1>
        <p className="mt-1 text-sm text-[#716D64]">
          Pick a class and browse the monthly schedule. Tap a session to book.
        </p>
      </div>

      <div className="mt-8">
        <div className="text-xs font-medium text-[#716D64] mb-3">Class type</div>
        {renderClassCards()}
      </div>

      <div className="mt-8 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-serif text-lg font-semibold text-[#444444]">
            {selectedItem?.name ?? "Schedule"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={bookedOnly}
                onChange={(e) => setBookedOnly(e.target.checked)}
                className="rounded border-[#E8DDD4]"
                disabled={!selectedItemId}
              />
              Booked only
            </label>
            <button
              type="button"
              onClick={() =>
                setMonthKey(monthDt.minus({ months: 1 }).toFormat("yyyy-LL"))
              }
              className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
            >
              Prev
            </button>
            <div className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm whitespace-nowrap">
              {monthDt.toFormat("LLLL yyyy")}
            </div>
            <button
              type="button"
              onClick={() =>
                setMonthKey(monthDt.plus({ months: 1 }).toFormat("yyyy-LL"))
              }
              className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>

        {!selectedItemId ? (
          <p className="mt-3 text-sm text-[#716D64]">
            Select a class type to view its schedule.
          </p>
        ) : null}

        <div className="min-h-5 mt-4" aria-live="polite">
          {error ? <div className="text-sm text-red-700">{error}</div> : null}
        </div>

        <div
          className={cn(
            "relative",
            scheduleLoading && "opacity-50 pointer-events-none",
          )}
          aria-busy={scheduleLoading}
        >
          {scheduleLoading ? (
            <span className="sr-only">Loading schedule</span>
          ) : null}

          {/* Mobile: horizontal scroll */}
          <div className="md:hidden mt-4 pt-1 -mx-4 overflow-x-auto overscroll-x-contain pb-2 px-4">
            <div className="flex gap-3 w-max">
              {monthDays.map((d) => {
                const isToday = d.dateKey === todayDateKey;
                const slots = selectedItemId
                  ? (dayMap.get(d.dateKey)?.slots ?? [])
                  : [];
                return (
                  <div
                    key={d.dateKey}
                    style={{ width: DAY_COLUMN_WIDTH }}
                    className={cn(
                      "shrink-0 min-h-[220px] rounded-2xl border bg-white/80 p-2 flex flex-col",
                      isToday
                        ? "border-[#A66A4A] ring-2 ring-[#A66A4A] ring-offset-2 ring-offset-[#FAF8F6]"
                        : "border-[#E8DDD4]",
                    )}
                  >
                    <div className="text-[10px] font-semibold text-[#716D64] uppercase">
                      {d.dt.toFormat("ccc")}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-base font-semibold leading-none">
                        {d.dt.day}
                      </span>
                      {isToday ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#A66A4A] text-white">
                          Today
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {!selectedItemId ? (
                        <div className="text-[10px] text-[#716D64]">—</div>
                      ) : slots.length === 0 ? (
                        <div className="text-[10px] text-[#716D64]">—</div>
                      ) : (
                        renderDaySlots(d.dateKey, slots)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Desktop: monthly grid */}
          <div className="hidden md:grid mt-6 grid-cols-7 gap-3">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="text-xs font-semibold text-[#716D64] px-2"
              >
                {d}
              </div>
            ))}
            {gridDays.map((item, idx) => {
              if (item.kind === "blank") {
                return <div key={`b-${idx}`} className="min-h-[200px]" />;
              }
              const isToday = item.dateKey === todayDateKey;
              const slots = selectedItemId
                ? (dayMap.get(item.dateKey)?.slots ?? [])
                : [];
              return (
                <div
                  key={item.dateKey}
                  className={cn(
                    "min-h-[200px] rounded-2xl border bg-white/80 p-2",
                    isToday
                      ? "border-[#A66A4A] ring-2 ring-[#A66A4A] ring-offset-2 ring-offset-[#FAF8F6]"
                      : "border-[#E8DDD4]",
                  )}
                >
                  <div className="text-xs font-semibold flex items-center gap-2">
                    <span>{item.dt.day}</span>
                    {isToday ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#A66A4A] text-white">
                        Today
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 space-y-1">
                    {!selectedItemId
                      ? null
                      : renderDaySlots(item.dateKey, slots)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
