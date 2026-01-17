"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DayPicker } from "react-day-picker";
import { DateTime } from "luxon";
import SiteHeader from "@/components/SiteHeader";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { SkipUpdate } from "@/components/SkipUpdate";
import type { PublicItem } from "./_components/ItemSelectField";
import { SlotButton } from "./_components/SlotButton";
import { WithLoading } from "./_components/WithLoading";
import { WithError } from "./_components/WithError";
import { Skeleton } from "./_components/Skeleton";
import { Checkbox } from "@/components/Checkbox";
import Link from "next/link";
import ArrowLeftIcon from "@heroicons/react/24/outline/ArrowLeftIcon";
import MagnifyingGlassIcon from "@heroicons/react/24/outline/MagnifyingGlassIcon";
import DocumentDuplicateIcon from "@heroicons/react/24/outline/DocumentDuplicateIcon";
import {
 buildCustomerBookingConfirmationMessage,
 formatKlParts,
} from "@/lib/bookingMessages";
import { normalizeHexColor } from "@/lib/itemColor";

type SlotDto = {
 id: string;
 itemId?: string;
 itemName?: string;
 itemColor?: string;
 dateKey: string;
 startMin: number;
 endMin: number;
 capacity: number;
 bookedCount: number;
 available: number;
 isFull: boolean;
 startUtc: string;
 endUtc: string;
};

function dateToDateKeyBusiness(date: Date): string {
 // IMPORTANT: Treat the DayPicker date as a "date-only" value, not an instant.
 // Converting a JS Date instant across timezones can shift the calendar day.
 return (
  DateTime.fromObject(
   { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() },
   { zone: BUSINESS_TIME_ZONE }
  ).toISODate() ?? ""
 );
}

function dateKeyToLocalDate(dateKey: string): Date {
 // IMPORTANT: DayPicker expects a local Date at local midnight.
 // Create a local date with the same Y-M-D as the business timezone dateKey.
 const dt = DateTime.fromISO(dateKey, { zone: BUSINESS_TIME_ZONE });
 return new Date(dt.year, dt.month - 1, dt.day);
}

function formatLocalTimeRange(startUtc: string, endUtc: string): string {
 const start = DateTime.fromISO(startUtc, { zone: "utc" }).toLocal();
 const end = DateTime.fromISO(endUtc, { zone: "utc" }).toLocal();
 return `${start.toFormat("h:mm a")} – ${end.toFormat("h:mm a")}`;
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

function BookingPageInner() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const queryItemId = searchParams.get("itemId");

 const [items, setItems] = useState<PublicItem[]>([]);
 const [itemsLoading, setItemsLoading] = useState(true);
 const [itemsError, setItemsError] = useState<string | null>(null);
 const [selectedItemId, setSelectedItemId] = useState<string>("");
 const [hasLoadedItemsOnce, setHasLoadedItemsOnce] = useState(false);

 const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
 const [month, setMonth] = useState<Date>(() => new Date());
 const [availableDateKeys, setAvailableDateKeys] = useState<Set<string>>(
  () => new Set()
 );
 const [loadingCalendar, setLoadingCalendar] = useState(false);
 const [allSlots, setAllSlots] = useState<SlotDto[]>([]);
 const [loadingSlots, setLoadingSlots] = useState(false);
 const [slotsError, setSlotsError] = useState<string | null>(null);

 const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
 const [name, setName] = useState("");
 const [email, setEmail] = useState("");
 const [whatsapp, setWhatsapp] = useState("");
 const [consentWhatsapp, setConsentWhatsapp] = useState(true);
 const [marketingOptIn, setMarketingOptIn] = useState(false);
 const [submitting, setSubmitting] = useState(false);
 const [submitError, setSubmitError] = useState<string | null>(null);
 const [successBookingCode, setSuccessBookingCode] = useState<string | null>(
  null
 );
 const [copied, setCopied] = useState(false);

 // When booking is completed, scroll to top so the success screen starts at the top.
 useEffect(() => {
  if (!successBookingCode) return;
  try {
   window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  } catch {
   // ignore
  }
 }, [successBookingCode]);

 // Persist user details for returning visitors (localStorage)
 useEffect(() => {
  try {
   const raw = window.localStorage.getItem("booking_details_v1");
   if (!raw) return;
   const parsed = JSON.parse(raw) as {
    name?: string;
    email?: string;
    whatsapp?: string;
   };
   if (typeof parsed.name === "string" && parsed.name.length > 0)
    setName(parsed.name);
   if (typeof parsed.email === "string" && parsed.email.length > 0)
    setEmail(parsed.email);
   if (typeof parsed.whatsapp === "string" && parsed.whatsapp.length > 0)
    setWhatsapp(parsed.whatsapp);
  } catch {
   // ignore
  }
 }, []);

 useEffect(() => {
  try {
   window.localStorage.setItem(
    "booking_details_v1",
    JSON.stringify({ name, email, whatsapp, updatedAt: Date.now() })
   );
  } catch {
   // ignore
  }
 }, [name, email, whatsapp]);

 // Load items (public)
 useEffect(() => {
  let cancelled = false;
  async function loadItems() {
   setItemsLoading(true);
   setItemsError(null);
   try {
    const res = await fetch("/api/public/items", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || !json?.ok) {
     throw new Error(json?.error?.message ?? "Failed to load classes");
    }
    const list = (json.data.items ?? []) as Array<{
     id: string;
     name: string;
     description: string;
     capacity: number;
     color?: string;
    }>;
    if (cancelled) return;
    setItems(list);
   } catch (e) {
    if (!cancelled)
     setItemsError(e instanceof Error ? e.message : "Failed to load classes");
   } finally {
    if (!cancelled) {
     setItemsLoading(false);
     setHasLoadedItemsOnce(true);
    }
   }
  }
  loadItems();
  return () => {
   cancelled = true;
  };
 }, []);

 // Apply itemId from URL (without reloading items)
 useEffect(() => {
  if (items.length === 0) return;
  const fromQuery = queryItemId ?? "";
  if (!fromQuery) return;
  if (!items.some((it) => it.id === fromQuery)) return;
  setSelectedItemId(fromQuery);
 }, [items, queryItemId]);

 const dateKey = useMemo(() => {
  if (!selectedDay) return null;
  return dateToDateKeyBusiness(selectedDay);
 }, [selectedDay]);


 // Keep URL in sync with selected item (only after a date is selected)
 useEffect(() => {
  if (!dateKey) return;
  const normalizedQuery = queryItemId ?? "";
  if (normalizedQuery === selectedItemId) return;
  if (!selectedItemId) {
   router.replace("/booking", { scroll: false });
   return;
  }
  router.replace(`/booking?itemId=${encodeURIComponent(selectedItemId)}`, {
   scroll: false,
  });
 }, [dateKey, queryItemId, router, selectedItemId]);

 

 const selectedClass = useMemo(() => {
  const bySelectedItem =
   !!selectedItemId && items.find((it) => it.id === selectedItemId);
  if (bySelectedItem) return bySelectedItem;
  const bySelectedSlotItemId =
   !!selectedSlotId && allSlots.find((s) => s.id === selectedSlotId)?.itemId;
  if (!bySelectedSlotItemId) return null;
  return items.find((it) => it.id === bySelectedSlotItemId) ?? null;
 }, [allSlots, items, selectedItemId, selectedSlotId]);

 const slots = useMemo(() => {
  if (!selectedItemId) return [];
  return allSlots.filter((s) => s.itemId === selectedItemId);
 }, [allSlots, selectedItemId]);

 const disabledItemIdsForDate = useMemo(() => {
  if (!dateKey) return new Set<string>();
  const hasAny = new Set<string>();
  for (const s of allSlots) {
   if (!s.itemId) continue;
   if (s.isFull) continue;
   hasAny.add(s.itemId);
  }
  const disabled = new Set<string>();
  for (const it of items) {
   if (!hasAny.has(it.id)) disabled.add(it.id);
  }
  return disabled;
 }, [allSlots, dateKey, items]);

 useEffect(() => {
  if (!dateKey) return;
  if (!selectedItemId) return;
  if (!disabledItemIdsForDate.has(selectedItemId)) return;
  setSelectedItemId("");
 }, [dateKey, disabledItemIdsForDate, selectedItemId]);

 const availabilityHint = useMemo(() => {
  if (loadingCalendar) return "Loading available dates…";
  if (availableDateKeys.size === 0) return "No available dates this month.";
  return "Pick a date to see available times.";
 }, [availableDateKeys.size, loadingCalendar]);

 const disabledDays = useMemo(() => {
  // Disable all dates not present in availableDateKeys.
  // If there are no available dates (or we're still loading), disable ALL day cells.
  const disableAll = loadingCalendar || availableDateKeys.size === 0;

  if (disableAll) return () => true;
  return (date: Date) => !availableDateKeys.has(dateToDateKeyBusiness(date));
 }, [availableDateKeys, loadingCalendar, month]);

 useEffect(() => {
  let cancelled = false;
  async function loadAvailableDates() {
   setLoadingCalendar(true);
   try {
   const m = DateTime.fromObject(
    { year: month.getFullYear(), month: month.getMonth() + 1, day: 1 },
    { zone: BUSINESS_TIME_ZONE }
   );
   const start = m.startOf("month").toISODate()!;
   const end = m.endOf("month").toISODate()!;

    const res = await fetch(
     `/api/public/available-dates?fromDateKey=${encodeURIComponent(
      start
     )}&toDateKey=${encodeURIComponent(end)}`
    );
    const json = await res.json();
    if (!res.ok || !json?.ok) {
     throw new Error(
      json?.error?.message ?? "Failed to load calendar availability"
     );
    }
    const keys = new Set<string>((json.data.dateKeys ?? []) as string[]);
    if (!cancelled) {
     setAvailableDateKeys(keys);

     // If no day selected yet, auto-select the first available date (or today if available).
    if (!selectedDay) {
     const todayKey = DateTime.now().setZone(BUSINESS_TIME_ZONE).toISODate()!;
      const pickKey = keys.has(todayKey) ? todayKey : [...keys][0];
      if (pickKey) setSelectedDay(dateKeyToLocalDate(pickKey));
     }
    }
   } catch {
    if (!cancelled) {
     setAvailableDateKeys(new Set());
    }
   } finally {
    if (!cancelled) setLoadingCalendar(false);
   }
  }
  loadAvailableDates();
  return () => {
   cancelled = true;
  };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [month]);

 useEffect(() => {
  let cancelled = false;
  async function load() {
   if (!dateKey) return;
   setLoadingSlots(true);
   setSlotsError(null);
   setSelectedSlotId(null);
   try {
    // Always load all sessions for the selected date.
    // We filter client-side so we can disable class types that have no sessions on this date.
    const res = await fetch(`/api/public/slots?dateKey=${encodeURIComponent(dateKey)}`);
    const json = await res.json();
    if (!res.ok || !json?.ok) {
     throw new Error(json?.error?.message ?? "Failed to load slots");
    }
    if (!cancelled) {
     setAllSlots(json.data.slots ?? []);
     // loaded
    }
   } catch (e) {
    if (!cancelled) {
     setAllSlots([]);
     setSlotsError(e instanceof Error ? e.message : "Failed to load slots");
     // loaded
    }
   } finally {
    if (!cancelled) setLoadingSlots(false);
   }
  }
  load();
  return () => {
   cancelled = true;
  };
 }, [dateKey]);

 useEffect(() => {
 }, [selectedDay, dateKey]);

 async function submitBooking() {
  if (!selectedSlotId) return;
  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedWhatsapp = whatsapp.trim();

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const whatsappOk =
   trimmedWhatsapp.length >= 6 &&
   trimmedWhatsapp.length <= 32 &&
   /^[+0-9][0-9\s()-]*$/.test(trimmedWhatsapp);

  if (!trimmedName) {
   setSubmitError("Please enter your name.");
   return;
  }
  if (!emailOk) {
   setSubmitError("Please enter a valid email.");
   return;
  }
  if (!whatsappOk) {
   setSubmitError("Please enter a valid WhatsApp number.");
   return;
  }
 if (!consentWhatsapp) {
  setSubmitError(
   "Please agree to receive booking-related updates via WhatsApp."
  );
  return;
 }

  setSubmitting(true);
  setSubmitError(null);
  try {
   const res = await fetch("/api/public/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
     slotId: selectedSlotId,
     name: trimmedName,
     email: trimmedEmail,
     whatsapp: trimmedWhatsapp,
     consentWhatsapp: true,
     marketingOptIn: Boolean(marketingOptIn),
    }),
   });
   const json = await res.json();
   if (!res.ok || !json?.ok) {
    throw new Error(json?.error?.message ?? "Booking failed");
   }
   setSuccessBookingCode(json.data.bookingCode);
  } catch (e) {
   setSubmitError(e instanceof Error ? e.message : "Booking failed");
  } finally {
   setSubmitting(false);
  }
 }

 if (successBookingCode) {
  const bookedSlot = selectedSlotId
   ? allSlots.find((s) => s.id === selectedSlotId) ?? null
   : null;
  const bookedClassName =
   bookedSlot?.itemName ??
   items.find((it) => it.id === bookedSlot?.itemId)?.name ??
   "";
  const bookedParts =
   bookedSlot && bookedClassName
    ? formatKlParts({
       dateKey: bookedSlot.dateKey,
       startMin: bookedSlot.startMin,
       endMin: bookedSlot.endMin,
       tz: BUSINESS_TIME_ZONE,
      })
    : null;
  const confirmationText =
   bookedSlot && bookedClassName
    ? buildCustomerBookingConfirmationMessage({
       name: name.trim() || "Pilates Girls",
       classTypeName: bookedClassName,
       bookingCode: successBookingCode,
       dateKey: bookedSlot.dateKey,
       startMin: bookedSlot.startMin,
       endMin: bookedSlot.endMin,
       tz: BUSINESS_TIME_ZONE,
      })
    : "";
  return (
   <div className="min-h-screen bg-[#FAF8F6] text-[#444444] px-6 py-24">
    <SiteHeader />
    <main className="max-w-2xl mx-auto mt-16">
     <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-8 shadow-sm">
      <h1 className="font-serif text-3xl font-bold mb-3">
       Your booking is ready
      </h1>
      <p className="text-[#5C574F] mb-6">
       We will send you a WhatsApp message and an email with the details.
      </p>
      {!!bookedParts && (
       <div className="rounded-2xl border border-[#E8DDD4] bg-white px-5 py-4 text-sm text-[#444444]">
        {!!bookedClassName && (
         <div className="font-semibold">{bookedClassName}</div>
        )}
        <div className={cn(!!bookedClassName ? "mt-1 text-[#716D64]" : "")}>
         {bookedParts.dateLabel} · {bookedParts.timeRangeLabel}
        </div>
       </div>
      )}
      <div className="mt-2">
       <div className="text-xs text-[#716D64] mb-1">Booking code</div>
       <div className="flex items-center gap-3">
        <div className="font-mono text-2xl tracking-widest">
         {successBookingCode}
        </div>
        <button
         type="button"
         className="px-3 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-xs hover:shadow-sm transition cursor-pointer"
         onClick={async () => {
          try {
           await navigator.clipboard.writeText(successBookingCode);
           setCopied(true);
           window.setTimeout(() => setCopied(false), 1200);
          } catch {
           // ignore
          }
         }}
        >
         <span className="inline-flex items-center gap-2">
          <DocumentDuplicateIcon className="h-4 w-4" />
          {copied ? "Copied" : "Copy"}
         </span>
        </button>
       </div>
      </div>
      <div className="mt-6 rounded-2xl border border-[#E8DDD4] bg-white/70 px-5 py-4">
       <div className="text-xs text-[#716D64] font-medium mb-2">
        Before you come
       </div>
       <pre className="whitespace-pre-wrap leading-loose text-sm text-[#444444]">
        {confirmationText}
       </pre>
      </div>
      <div className="flex items-center justify-between gap-2">
       <button
        className="mt-8 px-6 py-3 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 transition cursor-pointer"
        onClick={() => {
         setSuccessBookingCode(null);
         setCopied(false);
         setName("");
         setEmail("");
         setWhatsapp("");
         setConsentWhatsapp(true);
         setMarketingOptIn(false);
         setSelectedSlotId(null);
        }}
       >
        Make another booking
       </button>
       <Link
        href="/booking/check"
        className="mt-3 inline-flex items-center gap-2 text-sm text-[#716D64] underline hover:text-[#444444] cursor-pointer"
       >
        <MagnifyingGlassIcon className="h-4 w-4" />
        Booking check
       </Link>
      </div>
     </div>
    </main>
   </div>
  );
 }

 return (
  <div className="min-h-screen bg-[#FAF8F6] text-[#444444] px-6 py-24">
   <SiteHeader />

   <main className="max-w-5xl mx-auto mt-16">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
     <Link
      href="/"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
     >
      <ArrowLeftIcon className="h-4 w-4" />
      Back
     </Link>
     <Link
      href="/booking/check"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
     >
      <MagnifyingGlassIcon className="h-4 w-4" />
      Booking check
     </Link>
    </div>

    <div className="grid gap-10 md:grid-cols-[360px_1fr]">
     <section className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
      <h1 className="font-serif text-2xl font-bold mb-4">Book a time</h1>

      <DayPicker
       mode="single"
       selected={selectedDay}
       onSelect={setSelectedDay}
       month={month}
       onMonthChange={setMonth}
       weekStartsOn={0}
       disabled={disabledDays}
       className="w-full"
       classNames={{
        months: "w-full",
        month: "w-full",
        table: "w-full",
        head_row: "w-full",
        row: "w-full",
       }}
       styles={{
        table: { width: "100%" },
       }}
      />
      <div className="text-xs text-[#716D64] mt-4">{availabilityHint}</div>
     </section>

     <section className="space-y-6">
      <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
       <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-xl font-semibold">Class Type</h2>
        <div className="text-xs text-[#716D64]">{dateKey ?? ""}</div>
       </div>
       <div className="mt-1 text-sm text-[#716D64]">
        Choose a class type first to see available times.
       </div>

       <div className="mt-4">
        <SkipUpdate block={itemsLoading && hasLoadedItemsOnce}>
         <div className={cn(!dateKey ? "opacity-60" : "")}>
          {itemsError ? (
           <div className="text-sm text-red-700">{itemsError}</div>
          ) : (
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
            {items.map((it) => {
             const disabled = !dateKey || disabledItemIdsForDate.has(it.id);
             const selected = selectedItemId === it.id;
             const desc = (it.description ?? "").trim();
             const tinted = tintHexColor(it.color ?? "", 0.38);
             return (
              <button
               key={it.id}
               type="button"
               disabled={disabled}
               onClick={() => {
                setSelectedItemId(it.id);
                setSelectedSlotId(null);
                setSuccessBookingCode(null);
               }}
               style={!disabled && tinted ? { backgroundColor: tinted } : undefined}
               className={cn(
                "rounded-3xl border px-5 py-4 text-left transition cursor-pointer h-full relative",
                disabled
                 ? "bg-[#FAF8F6] border-[#E8DDD4] opacity-60 cursor-not-allowed"
                 : "bg-white border-[#E8DDD4] hover:shadow-sm",
                selected
                 ? "ring-2 ring-[#A66A4A] ring-offset-2 ring-offset-[#FAF8F6] shadow-sm"
                 : ""
               )}
              >
               {selected ? (
                <span className="absolute top-3 right-3 h-6 w-6 rounded-full border border-[#A66A4A] bg-white/80 text-[#A66A4A] flex items-center justify-center text-sm leading-none">
                 ✓
                </span>
               ) : null}
               <div className="h-full flex flex-col">
                <div className="flex items-center justify-between gap-3">
                 <div className="font-serif text-lg font-semibold text-[#444444]">
                  {it.name}
                 </div>
                 {!!it.color && (
                  <span
                   className="shrink-0 inline-block h-3 w-3 rounded-full border border-black/10"
                   style={{ backgroundColor: it.color }}
                  />
                 )}
                </div>
                <div className="mt-1 text-sm text-[#5C574F] line-clamp-2 flex-1">
                 {desc || " "}
                </div>
               </div>
              </button>
             );
            })}
           </div>
          )}
         </div>
        </SkipUpdate>
        {!dateKey ? (
         <div className="mt-2 text-xs text-[#716D64]">
          Pick a date first.
         </div>
        ) : selectedItemId && disabledItemIdsForDate.has(selectedItemId) ? (
         <div className="mt-2 text-xs text-[#A66A4A]">
          No sessions for this class on the selected date.
         </div>
        ) : null}
       </div>
      </div>

      <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
       <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-xl font-semibold cursor-pointer">
         Available times
        </h2>
        <div className="text-xs text-[#716D64]">
         {selectedItemId
          ? items.find((it) => it.id === selectedItemId)?.name ?? ""
          : ""}
        </div>
       </div>

       <SkipUpdate block={loadingSlots || loadingCalendar || itemsLoading}>
        <WithLoading
         loading={loadingSlots || loadingCalendar || itemsLoading}
         fallback={
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
           {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-full" />
           ))}
          </div>
         }
        >
         <WithError
          error={slotsError}
          fallback={(msg) => (
           <div className="mt-5 text-sm text-red-700">{msg}</div>
          )}
         >
          {!selectedItemId ? (
           <div className="mt-5 text-sm text-[#716D64]">
            Choose a class type above.
           </div>
          ) : slots.length === 0 ? (
           <div className="mt-5 text-sm text-[#716D64]">
            No sessions on this date.
           </div>
          ) : (
           <div className="mt-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
             {slots.map((s) => {
              const label = formatLocalTimeRange(s.startUtc, s.endUtc);
              const selected = selectedSlotId === s.id;
              const itemLabel =
               s.itemName ??
               items.find((it) => it.id === s.itemId)?.name ??
               items.find((it) => it.id === selectedItemId)?.name ??
               "";
              const subtitle = (
               <span className="inline-flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
                {!!itemLabel && (
                 <span className="text-[#716D64]">{itemLabel}</span>
                )}
                {s.capacity > 1 ? (
                 <span className="text-[#716D64]">
                  {!!itemLabel && "· "}
                  {s.available} / {s.capacity} available
                 </span>
                ) : null}
               </span>
              );
              return (
               <SlotButton
                key={s.id}
                disabled={s.isFull}
                selected={selected}
                onClick={() => setSelectedSlotId(s.id)}
                color={s.itemColor}
                title={label}
                subtitle={subtitle}
               />
              );
             })}
            </div>

            {(itemsLoading || !!selectedClass) && (
             <div>
              <div className="text-xs text-[#716D64] mb-1">
               Class Description
              </div>
              {itemsLoading ? (
               <div className="space-y-2">
                <Skeleton className="h-4 w-48" rounded="rounded-full" />
                <Skeleton className="h-20 w-full" rounded="rounded-2xl" />
               </div>
              ) : (
               <div className="whitespace-pre-wrap rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm text-[#444444]">
                <div className="font-semibold">
                 {selectedClass?.name ?? "—"}
                </div>
                <div className="mt-1 text-sm text-[#5C574F]">
                 {selectedClass?.description?.trim() || "—"}
                </div>
               </div>
              )}
             </div>
            )}
           </div>
          )}
         </WithError>
        </WithLoading>
       </SkipUpdate>
      </div>

      <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
       <h2 className="font-serif text-xl font-semibold mb-4">Your details</h2>
       <div className="grid gap-3">
        <label className="grid gap-1">
         <span className="text-xs text-[#716D64]">Name</span>
         <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={cn(
           "rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm",
           "outline-none focus:ring-2 focus:ring-[#DFD1C9]"
          )}
          placeholder="Your name"
         />
        </label>
        <label className="grid gap-1">
         <span className="text-xs text-[#716D64]">Email</span>
         <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={cn(
           "rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm",
           "outline-none focus:ring-2 focus:ring-[#DFD1C9]"
          )}
          placeholder="you@example.com"
          inputMode="email"
         />
        </label>
        <label className="grid gap-1">
         <span className="text-xs text-[#716D64]">WhatsApp</span>
         <input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          className={cn(
           "rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm",
           "outline-none focus:ring-2 focus:ring-[#DFD1C9]"
          )}
          placeholder="+60 12-345 6789"
          inputMode="tel"
         />
        </label>

        <div className="mt-2 rounded-2xl border border-[#E8DDD4] bg-white/70 px-4 py-4 space-y-3">
         <div className="text-xs text-[#716D64] font-medium">Agreements</div>
         <Checkbox
          checked={consentWhatsapp}
          onCheckedChange={setConsentWhatsapp}
          label="* Receive booking updates via WhatsApp"
         />
         <Checkbox
          checked={marketingOptIn}
          onCheckedChange={setMarketingOptIn}
          label="Receive event / promotion updates"
         />
        </div>
        {!!submitError && (
         <div className="text-sm text-red-700">{submitError}</div>
        )}
        <button
         disabled={
          !selectedSlotId ||
          !name ||
          !email ||
          !whatsapp ||
          !consentWhatsapp ||
          submitting
         }
         onClick={submitBooking}
         className="mt-2 px-6 py-3 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
         {submitting ? "Submitting…" : "Submit booking"}
        </button>
        <div className="text-xs text-[#716D64]">
         After submit, you’ll see confirmation. If anything changes, we’ll email
         you.
        </div>
 
       </div>
      </div>
     </section>
    </div>

    <div className="mt-8 flex justify-center">
     <Link
      href="/admin"
      className="text-xs text-[#716D64] underline hover:text-[#444444] cursor-pointer"
     >
      Admin
     </Link>
    </div>
   </main>
  </div>
 );
}

export default function BookingPage() {
 return (
  <Suspense
   fallback={
    <div className="min-h-screen bg-[#FAF8F6] text-[#444444] px-6 py-24">
     <SiteHeader />
     <main className="max-w-2xl mx-auto mt-16 text-sm text-[#716D64]">
      Loading…
     </main>
    </div>
   }
  >
   <BookingPageInner />
  </Suspense>
 );
}
