"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import SiteHeader from "@/components/SiteHeader";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { WithLoading } from "./_components/WithLoading";
import { WithError } from "./_components/WithError";
import { DayChip } from "./_components/DayChip";
import { Switch } from "@/components/Switch";

type PublicCalendarDay = {
 dateKey: string;
 slots: Array<{
  id: string;
  itemName?: string;
  itemColor?: string;
  startMin: number;
  endMin: number;
  capacity: number;
  bookedCount: number;
  notes: string;
  bookingNames: string[];
 }>;
};

function minutesToHhmm(min: number): string {
 const hh = Math.floor(min / 60);
 const mm = min % 60;
 return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function minutesToAmPm(min: number): string {
 const hh = Math.floor(min / 60);
 const mm = min % 60;
 const ampm = hh >= 12 ? "PM" : "AM";
 const h12 = ((hh + 11) % 12) + 1;
 return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

function minutesToAmPmRange(startMin: number, endMin: number): string {
 return `${minutesToAmPm(startMin)}–${minutesToAmPm(endMin)}`;
}

export default function PublicCalendarPage() {
 const [monthKey, setMonthKey] = useState(() =>
  DateTime.now().setZone(BUSINESS_TIME_ZONE).toFormat("yyyy-LL")
 );
 const monthDt = useMemo(
  () => DateTime.fromFormat(monthKey, "yyyy-LL", { zone: BUSINESS_TIME_ZONE }),
  [monthKey]
 );
 const fromDateKey = useMemo(
  () => monthDt.startOf("month").toISODate()!,
  [monthDt]
 );
 const toDateKey = useMemo(
  () => monthDt.endOf("month").toISODate()!,
  [monthDt]
 );

 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [days, setDays] = useState<PublicCalendarDay[]>([]);
 const [bookedOnly, setBookedOnly] = useState(false);
 const [dayModalDateKey, setDayModalDateKey] = useState<string | null>(null);
 const [mobileDateKey, setMobileDateKey] = useState<string>(() => {
  const now = DateTime.now().setZone(BUSINESS_TIME_ZONE);
  return now.toISODate() ?? "";
 });

 const filteredDays = useMemo(() => {
  if (!bookedOnly) return days;
  return days
   .map((d) => ({
    ...d,
    slots: d.slots.filter((s) => (s.bookingNames?.length ?? 0) > 0),
   }))
   .filter((d) => d.slots.length > 0);
 }, [days, bookedOnly]);

 const dayMap = useMemo(() => {
  const m = new Map<string, PublicCalendarDay>();
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

 const mobileSlots = dayMap.get(mobileDateKey)?.slots ?? [];

 useEffect(() => {
  const now = DateTime.now().setZone(BUSINESS_TIME_ZONE);
  const inMonth = now.toFormat("yyyy-LL") === monthKey;
  setMobileDateKey(inMonth ? now.toISODate()! : fromDateKey);
 }, [monthKey, fromDateKey]);

 useEffect(() => {
  const el = document.getElementById(`mobile-day-${mobileDateKey}`);
  el?.scrollIntoView({
   inline: "center",
   block: "nearest",
   behavior: "smooth",
  });
 }, [mobileDateKey]);

 useEffect(() => {
  let cancelled = false;
  async function load() {
   setLoading(true);
   setError(null);
   try {
    const res = await fetch(
     `/api/public/calendar?fromDateKey=${encodeURIComponent(
      fromDateKey
     )}&toDateKey=${encodeURIComponent(toDateKey)}`,
     { cache: "no-store" }
    );
    const json = await res.json();
    if (!res.ok || !json?.ok) {
     throw new Error(json?.error?.message ?? "Failed to load calendar");
    }
    if (!cancelled) setDays(json.data.days ?? []);
   } catch (e) {
    if (!cancelled)
     setError(e instanceof Error ? e.message : "Failed to load calendar");
   } finally {
    if (!cancelled) setLoading(false);
   }
  }
  load();
  return () => {
   cancelled = true;
  };
 }, [fromDateKey, toDateKey]);

 const gridDays = useMemo(() => {
  const start = monthDt.startOf("month");
  const end = monthDt.endOf("month");
  const startWeekday = start.weekday === 7 ? 0 : start.weekday; // 0..6, sunday start
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

 return (
  <div className="min-h-screen bg-[#FAF8F6] text-[#444444] px-6 py-24">
   <SiteHeader />
   <main className="max-w-7xl mx-auto mt-16">
    <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
     <div className="flex items-center justify-between gap-4 flex-wrap">
      <div>
       <h1 className="font-serif text-3xl font-bold">Calendar</h1>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
       <Switch
        checked={bookedOnly}
        onCheckedChange={setBookedOnly}
        label="Booked only"
       />
       <button
        onClick={() =>
         setMonthKey(monthDt.minus({ months: 1 }).toFormat("yyyy-LL"))
        }
        className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition"
       >
        Prev
       </button>
       <div className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm">
        {monthDt.toFormat("LLLL yyyy")}
       </div>
       <button
        onClick={() =>
         setMonthKey(monthDt.plus({ months: 1 }).toFormat("yyyy-LL"))
        }
        className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition"
       >
        Next
       </button>
      </div>
     </div>
     <WithLoading
      loading={loading}
      fallback={<div className="mt-4 text-sm text-[#716D64]">Loading…</div>}
     >
      <WithError
       error={error}
       fallback={(msg) => (
        <div className="mt-4 text-sm text-red-700">{msg}</div>
       )}
      >
       {null}
      </WithError>
     </WithLoading>

     {/* Mobile: horizontal day strip + selected day detail */}
     <div className="md:hidden mt-6">
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
       {monthDays.map((d) => {
        const hasSlots = (dayMap.get(d.dateKey)?.slots?.length ?? 0) > 0;
        const selected = d.dateKey === mobileDateKey;
        return (
         <DayChip
          key={d.dateKey}
          dateKey={d.dateKey}
          dt={d.dt}
          selected={selected}
          hasSlots={hasSlots}
          onClick={() => setMobileDateKey(d.dateKey)}
         />
        );
       })}
      </div>

      <div className="mt-4 rounded-3xl border border-[#E8DDD4] bg-white/80 p-5">
       <div className="flex items-baseline justify-between gap-3">
        <div className="font-serif text-xl font-semibold">{mobileDateKey}</div>
       </div>

       <div className="mt-4 space-y-3">
        {mobileSlots.length === 0 ? (
         <div className="text-sm text-[#716D64]">No sessions</div>
        ) : (
         mobileSlots.map((s) => (
          <div
           key={s.id}
           className="rounded-2xl border border-[#E8DDD4] px-4 py-3"
           style={{
            backgroundColor: s.itemColor ? s.itemColor : "rgba(255,255,255,0.8)",
           }}
          >
           <div className="flex items-center justify-between">
            <div className="text-sm font-medium">
             {minutesToAmPmRange(s.startMin, s.endMin)}
            </div>
            <div className="text-xs text-[#716D64]">
             {s.bookedCount}/{s.capacity}
            </div>
           </div>
           <div className="text-[11px] text-[#716D64] mt-1">
            {s.itemName ?? s.notes ?? ""}
           </div>
           <div className="text-xs text-[#5C574F] mt-1">
            {s.bookingNames.length} bookings
           </div>
          </div>
         ))
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
       if (item.kind === "blank")
        return <div key={`b-${idx}`} className="h-[220px]" />;
       const day = dayMap.get(item.dateKey);
       const slots = day?.slots ?? [];
       const visibleSlots = slots.slice(0, 3);
       const extraSlotsCount = Math.max(0, slots.length - visibleSlots.length);
       return (
        <div
         key={item.dateKey}
         className="h-[220px] rounded-2xl border border-[#E8DDD4] bg-white/80 p-2"
        >
         <div className="flex items-center justify-between">
          <div className="text-xs font-semibold">{item.dt.day}</div>
          <div className="text-[10px] text-[#716D64]">{item.dateKey}</div>
         </div>
         <div className="mt-2 space-y-1">
          {slots.length === 0 ? (
           <div className="text-xs text-[#716D64]">No sessions</div>
          ) : (
           <>
            {visibleSlots.map((s) => (
             <div
              key={s.id}
              className="text-[11px] rounded-xl px-2 py-1"
              style={{
               backgroundColor: s.itemColor
                ? s.itemColor
                : "rgba(255,255,255,0.6)",
              }}
             >
              <div className="flex items-center justify-between">
               <div>{minutesToAmPmRange(s.startMin, s.endMin)}</div>
               <div className="text-[10px] text-[#716D64]">
                {s.bookedCount}/{s.capacity}
               </div>
              </div>
              {!!(s.itemName ?? s.notes) && (
               <div className="text-[10px] text-[#716D64] truncate">
                {s.itemName ?? s.notes}
               </div>
              )}
              <div className="text-[10px] text-[#5C574F]">
               {s.bookingNames.length} bookings
              </div>
             </div>
            ))}
            {!!extraSlotsCount && (
             <button
              type="button"
              onClick={() => setDayModalDateKey(item.dateKey)}
              className="text-[11px] text-[#7A4B3A] underline px-1 hover:text-[#5E3A2D] cursor-pointer text-left"
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
           (dayMap.get(dayModalDateKey)?.slots ?? []).map((s) => (
            <div
             key={s.id}
             className="rounded-3xl border border-[#E8DDD4] bg-white px-5 py-4"
             style={{
              backgroundColor: s.itemColor ? s.itemColor : "rgba(255,255,255,0.6)",
             }}
            >
             <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-[#444444]">
               {minutesToAmPmRange(s.startMin, s.endMin)}
              </div>
              <div className="text-xs text-[#716D64]">
               {s.bookedCount}/{s.capacity}
              </div>
             </div>
             <div className="mt-2 text-xs text-[#716D64]">{s.itemName ?? ""}</div>
             <div
              className={cn(
               "mt-1 text-xs",
               s.bookingNames.length > 0
                ? "text-[#444444] font-semibold"
                : "text-[#716D64]"
              )}
             >
              {s.bookingNames.length} bookings
             </div>
            </div>
           ))
          )}
         </div>
        </div>
       </div>
      </div>
     ) : null}
    </div>
   </main>
  </div>
 );
}
