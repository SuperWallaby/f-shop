"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DayPicker } from "react-day-picker";
import "@/styles/day-picker.css";
import { DateTime } from "luxon";
import SiteHeader from "@/components/SiteHeader";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { SkipUpdate } from "@/components/SkipUpdate";
import type { PublicItem } from "./_components/ItemSelectField";
import { SlotButton } from "./_components/SlotButton";
import { WithLoading } from "./_components/WithLoading";
import { WithError } from "./_components/WithError";
import { Skeleton, SkeletonLine } from "./_components/Skeleton";
import { BookingCalendarSkeleton } from "./_components/BookingCalendarSkeleton";
import { ClassTypeGridSkeleton } from "./_components/ClassTypeGridSkeleton";
import Link from "next/link";
import ArrowLeftIcon from "@heroicons/react/24/outline/ArrowLeftIcon";
import CalendarDaysIcon from "@heroicons/react/24/outline/CalendarDaysIcon";
import MagnifyingGlassIcon from "@heroicons/react/24/outline/MagnifyingGlassIcon";
import ChevronDownIcon from "@heroicons/react/24/outline/ChevronDownIcon";
import InformationCircleIcon from "@heroicons/react/24/outline/InformationCircleIcon";
import { FaWhatsapp } from "react-icons/fa";
import {
  buildCustomerBookingConfirmationMessage,
  formatKlParts,
} from "@/lib/bookingMessages";
import { normalizeHexColor } from "@/lib/itemColor";
import { BookingGuestPanel } from "./_components/BookingGuestPanel";
import type { BookingGuestAuthedClient } from "./_components/BookingGuestPanel";
import type { PublicPlanDto } from "@/lib/planDto";
import {
  matchPlanCategoryForClassName,
  PLAN_CATEGORY_DISPLAY_ORDER,
  planPurchaseGroupHeading,
} from "@/lib/planCategoryDisplay";
import {
  buildBookingDraft,
  clearBookingDraft,
  readBookingDraft,
  writeBookingDraft,
} from "./_lib/bookingDraft";
import {
  readLastClassTypeId,
  writeLastClassTypeId,
} from "./_lib/lastClassType";

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
  bookable: boolean;
  isFull: boolean;
  startUtc: string;
  endUtc: string;
};

function isSlotSelectable(slot: SlotDto): boolean {
  return slot.bookable !== false && !slot.isFull;
}

function dateToDateKeyBusiness(date: Date): string {
  // IMPORTANT: Treat the DayPicker date as a "date-only" value, not an instant.
  // Converting a JS Date instant across timezones can shift the calendar day.
  return (
    DateTime.fromObject(
      {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
      },
      { zone: BUSINESS_TIME_ZONE },
    ).toISODate() ?? ""
  );
}

function dateKeyToLocalDate(dateKey: string): Date {
  // IMPORTANT: DayPicker expects a local Date at local midnight.
  // Create a local date with the same Y-M-D as the business timezone dateKey.
  const dt = DateTime.fromISO(dateKey, { zone: BUSINESS_TIME_ZONE });
  return new Date(dt.year, dt.month - 1, dt.day);
}

function formatBookingDateLabel(dateKey: string): string {
  return DateTime.fromISO(dateKey, { zone: BUSINESS_TIME_ZONE }).toFormat(
    "LLL dd, ccc",
  );
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
  const [selectedItemId, setSelectedItemId] = useState("");

  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  const [month, setMonth] = useState<Date>(() => new Date());
  const setCalendarMonth = useCallback((next: Date) => {
    setLoadingCalendar(true);
    setMonth(next);
  }, []);
  const [availableDateKeys, setAvailableDateKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [allSlots, setAllSlots] = useState<SlotDto[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const pendingSlotIdRef = useRef<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [signUp, setSignUp] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successBookingCode, setSuccessBookingCode] = useState<string | null>(
    null,
  );
  const [signedUpOnBook, setSignedUpOnBook] = useState(false);
  const [needsPlanHint, setNeedsPlanHint] = useState(false);
  const [planOptions, setPlanOptions] = useState<PublicPlanDto[]>([]);
  const [selectedPlanInterest, setSelectedPlanInterest] = useState("");
  const [copied, setCopied] = useState(false);
  const [openPrepareInfo, setOpenPrepareInfo] = useState(false);
  const [openNeedToKnow, setOpenNeedToKnow] = useState(false);
  const [authedClient, setAuthedClient] =
    useState<BookingGuestAuthedClient | null>(null);

  useEffect(() => {
    const draft = readBookingDraft();
    if (draft?.itemId) setSelectedItemId(draft.itemId);
    if (draft?.dateKey) {
      setSelectedDay(dateKeyToLocalDate(draft.dateKey));
      if (draft.monthKey) {
        const [y, m] = draft.monthKey.split("-").map(Number);
        if (y && m) setCalendarMonth(new Date(y, m - 1, 1));
      } else {
        setCalendarMonth(dateKeyToLocalDate(draft.dateKey));
      }
    }
    if (draft?.slotId) pendingSlotIdRef.current = draft.slotId;
    if (draft?.email) setEmail(draft.email);
    if (draft?.whatsapp) setWhatsapp(draft.whatsapp);
    else if (draft?.whatsappOverride) setWhatsapp(draft.whatsappOverride);
    setDraftRestored(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMe() {
      try {
        const res = await fetch("/api/public/client/me", {
          credentials: "include",
          cache: "no-store",
        });
        const json = await res.json();
        if (cancelled || !res.ok || !json?.ok || !json.data?.authed) {
          if (!cancelled) setAuthedClient(null);
          return;
        }
        const c = json.data.client as {
          name?: string;
          email?: string;
          whatsapp?: string;
        };
        const next: BookingGuestAuthedClient = {
          name: (c?.name ?? "").trim(),
          email: (c?.email ?? "").trim(),
          whatsapp: (c?.whatsapp ?? "").trim(),
        };
        if (!cancelled) {
          setAuthedClient(next);
          if (next.email) setEmail(next.email);
          if (next.whatsapp) setWhatsapp(next.whatsapp);
          setSignUp(false);
          setPassword("");
        }
      } catch {
        if (!cancelled) setAuthedClient(null);
      }
    }
    void loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!successBookingCode || !needsPlanHint) return;
    let cancelled = false;
    async function loadPlans() {
      try {
        const res = await fetch("/api/public/plans", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json?.ok) return;
        if (!cancelled) {
          const list = ((json.data.plans ?? []) as PublicPlanDto[]).slice();
          list.sort(
            (a, b) =>
              a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
          );
          setPlanOptions(list);
        }
      } catch {
        if (!cancelled) setPlanOptions([]);
      }
    }
    void loadPlans();
    return () => {
      cancelled = true;
    };
  }, [successBookingCode, needsPlanHint]);

  // When booking is completed, scroll to top so the success screen starts at the top.
  useEffect(() => {
    if (!successBookingCode) return;
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    } catch {
      // ignore
    }
  }, [successBookingCode]);

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
          setItemsError(
            e instanceof Error ? e.message : "Failed to load classes",
          );
      } finally {
        if (!cancelled) {
          setItemsLoading(false);
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

  useEffect(() => {
    if (!selectedItemId) return;
    writeLastClassTypeId(selectedItemId);
  }, [selectedItemId]);

  const dateKey = useMemo(() => {
    if (!selectedDay) return null;
    return dateToDateKeyBusiness(selectedDay);
  }, [selectedDay]);

  const persistBookingDraft = useCallback(() => {
    writeBookingDraft(
      buildBookingDraft({
        itemId: selectedItemId,
        dateKey,
        slotId: selectedSlotId,
        month,
        email,
        whatsapp,
      }),
    );
  }, [
    dateKey,
    email,
    month,
    selectedItemId,
    selectedSlotId,
    whatsapp,
  ]);

  useEffect(() => {
    if (!draftRestored) return;
    if (successBookingCode) {
      clearBookingDraft();
      return;
    }
    persistBookingDraft();
  }, [draftRestored, persistBookingDraft, successBookingCode]);

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

  const slots = useMemo(() => {
    if (!selectedItemId) return [];
    return allSlots.filter((s) => s.itemId === selectedItemId);
  }, [allSlots, selectedItemId]);

  const disabledItemIdsForDate = useMemo(() => {
    if (!dateKey) return new Set<string>();
    const hasSession = new Set<string>();
    for (const s of allSlots) {
      if (!s.itemId) continue;
      hasSession.add(s.itemId);
    }
    const disabled = new Set<string>();
    for (const it of items) {
      if (!hasSession.has(it.id)) disabled.add(it.id);
    }
    return disabled;
  }, [allSlots, dateKey, items]);

  useEffect(() => {
    if (!dateKey || loadingSlots) return;
    if (!selectedItemId) return;
    if (!disabledItemIdsForDate.has(selectedItemId)) return;
    setSelectedItemId("");
  }, [dateKey, disabledItemIdsForDate, loadingSlots, selectedItemId]);

  const classTypesLoading =
    itemsLoading || (Boolean(dateKey) && loadingSlots);

  const showClassTypeHints = !loadingCalendar && !classTypesLoading;
  const showTimesHints =
    !loadingCalendar && !loadingSlots && !itemsLoading;

  // Auto-select saved class type once loading finishes and it is selectable
  useEffect(() => {
    if (classTypesLoading || loadingCalendar || itemsLoading) return;
    if (items.length === 0) return;
    if (queryItemId && items.some((it) => it.id === queryItemId)) return;

    const last = readLastClassTypeId();
    if (!last || !items.some((it) => it.id === last)) return;

    const currentSelectable =
      !!selectedItemId &&
      (!dateKey || !disabledItemIdsForDate.has(selectedItemId));
    if (currentSelectable) return;

    if (!dateKey) {
      setSelectedItemId(last);
      return;
    }

    if (!disabledItemIdsForDate.has(last)) {
      setSelectedItemId(last);
      return;
    }

    if (selectedItemId) {
      setSelectedItemId("");
    }
  }, [
    classTypesLoading,
    dateKey,
    disabledItemIdsForDate,
    items,
    itemsLoading,
    loadingCalendar,
    queryItemId,
    selectedItemId,
  ]);

  const disabledDays = useMemo(() => {
    const todayKey = DateTime.now()
      .setZone(BUSINESS_TIME_ZONE)
      .toISODate()!;
    // Disable all dates not present in availableDateKeys.
    // If there are no available dates (or we're still loading), disable ALL day cells.
    const disableAll = loadingCalendar || availableDateKeys.size === 0;

    if (disableAll) return () => true;
    return (date: Date) => {
      const key = dateToDateKeyBusiness(date);
      if (key < todayKey) return true;
      return !availableDateKeys.has(key);
    };
  }, [availableDateKeys, loadingCalendar]);

  useEffect(() => {
    let cancelled = false;
    async function loadAvailableDates() {
      setLoadingCalendar(true);
      try {
        const m = DateTime.fromObject(
          { year: month.getFullYear(), month: month.getMonth() + 1, day: 1 },
          { zone: BUSINESS_TIME_ZONE },
        );
        const start = m.startOf("month").toISODate()!;
        const end = m.endOf("month").toISODate()!;

        const res = await fetch(
          `/api/public/available-dates?fromDateKey=${encodeURIComponent(
            start,
          )}&toDateKey=${encodeURIComponent(end)}`,
        );
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(
            json?.error?.message ?? "Failed to load calendar availability",
          );
        }
        const keys = new Set<string>((json.data.dateKeys ?? []) as string[]);
        if (!cancelled) {
          setAvailableDateKeys(keys);

          // If no day selected yet, auto-select today or the first upcoming available date.
          setSelectedDay((current) => {
            if (current) return current;
            const todayKey = DateTime.now()
              .setZone(BUSINESS_TIME_ZONE)
              .toISODate()!;
            const upcoming = [...keys]
              .filter((k) => k >= todayKey)
              .sort((a, b) => a.localeCompare(b));
            const pickKey = keys.has(todayKey) ? todayKey : upcoming[0];
            return pickKey ? dateKeyToLocalDate(pickKey) : current;
          });
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
        const res = await fetch(
          `/api/public/slots?dateKey=${encodeURIComponent(dateKey)}`,
        );
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error?.message ?? "Failed to load slots");
        }
        if (!cancelled) {
          const slots = (json.data.slots ?? []) as SlotDto[];
          setAllSlots(slots);
          const pending = pendingSlotIdRef.current;
          if (pending) {
            const found = slots.find((s) => s.id === pending);
            if (found && isSlotSelectable(found)) {
              setSelectedSlotId(pending);
            }
            pendingSlotIdRef.current = null;
          }
        }
      } catch (e) {
        if (!cancelled) {
          setAllSlots([]);
          setSlotsError(
            e instanceof Error ? e.message : "Failed to load slots",
          );
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

  useEffect(() => {}, [selectedDay, dateKey]);

  async function submitBooking() {
    if (!selectedSlotId) return;

    const trimmedEmail = (authedClient?.email || email).trim();
    const trimmedWhatsapp = (authedClient?.whatsapp || whatsapp).trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
    const loggedIn = Boolean(authedClient);

    if (!emailOk) {
      setSubmitError("Please enter a valid email.");
      return;
    }
    if (!trimmedWhatsapp) {
      setSubmitError(
        loggedIn
          ? "Your account is missing a WhatsApp number. Update it in My account."
          : "Please enter your WhatsApp number.",
      );
      return;
    }
    if (!loggedIn && signUp && !/^\d{4}$/.test(password)) {
      setSubmitError("Enter a 4-digit password to create an account.");
      return;
    }

    const guestName =
      (authedClient?.name || "").trim() ||
      trimmedEmail.split("@")[0]?.trim().replace(/[._+-]+/g, " ") ||
      "Guest";

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/public/bookings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: selectedSlotId,
          name: guestName,
          email: trimmedEmail,
          whatsapp: trimmedWhatsapp,
          consentWhatsapp: true,
          marketingOptIn: false,
          ...(!loggedIn && signUp ? { signUp: true, password } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Booking failed");
      }
      const didSignUp = Boolean(json.data?.signedUp);
      setSignedUpOnBook(didSignUp);
      setPassword("");

      let planHint = didSignUp || !loggedIn;
      try {
        const meRes = await fetch("/api/public/client/me", {
          credentials: "include",
          cache: "no-store",
        });
        const meJson = await meRes.json().catch(() => null);
        if (meRes.ok && meJson?.ok && meJson.data?.authed) {
          const credits = Number(meJson.data.balance?.balance ?? 0);
          const c = meJson.data.client as {
            name?: string;
            email?: string;
            whatsapp?: string;
          };
          setAuthedClient({
            name: (c?.name ?? "").trim(),
            email: (c?.email ?? "").trim(),
            whatsapp: (c?.whatsapp ?? "").trim(),
          });
          planHint = didSignUp || !(credits > 0);
        } else {
          planHint = true;
        }
      } catch {
        planHint = didSignUp || !loggedIn;
      }
      setNeedsPlanHint(planHint);
      setSuccessBookingCode(json.data.bookingCode);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  const guestName =
    email.trim().split("@")[0]?.trim().replace(/[._+-]+/g, " ") || "Guest";

  if (successBookingCode) {
    const bookedSlot = selectedSlotId
      ? (allSlots.find((s) => s.id === selectedSlotId) ?? null)
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
            name: guestName || "Pilates Girls",
            classTypeName: bookedClassName,
            bookingCode: successBookingCode,
            dateKey: bookedSlot.dateKey,
            startMin: bookedSlot.startMin,
            endMin: bookedSlot.endMin,
            tz: BUSINESS_TIME_ZONE,
          })
        : "";

    const preferredPlanCategory = matchPlanCategoryForClassName(bookedClassName);
    const sortedPlanOptions = (() => {
      const list = planOptions.slice();
      const catRank = (category: PublicPlanDto["category"]) => {
        if (preferredPlanCategory && category === preferredPlanCategory) return -1;
        const idx = PLAN_CATEGORY_DISPLAY_ORDER.indexOf(category);
        return idx >= 0 ? idx : 999;
      };
      list.sort(
        (a, b) =>
          catRank(a.category) - catRank(b.category) ||
          a.sortOrder - b.sortOrder ||
          a.title.localeCompare(b.title),
      );
      return list;
    })();

    const planInterestLabel = (() => {
      if (!needsPlanHint || !selectedPlanInterest) return null;
      if (selectedPlanInterest === "__consult__") {
        return "I'll decide after a consultation";
      }
      if (selectedPlanInterest === "__event_promo__") {
        return "Event / promotion";
      }
      const plan = planOptions.find((p) => p.id === selectedPlanInterest);
      if (!plan) return null;
      const group = planPurchaseGroupHeading(plan.category);
      return `${group} · ${plan.title} (RM ${plan.priceRm})`;
    })();

    // Replace wasap.my with official WhatsApp deep link (wa.me)
    const phone = "60145403560"; // country code + number, NO "+" and NO spaces
    const wasapMessage =
      bookedParts && bookedClassName
        ? [
            "Booking Done",
            `Class: ${bookedClassName}`,
            `Date: ${bookedParts.dateLabel}`,
            `Time: ${bookedParts.timeLabel}`,
            `Booking Code: ${successBookingCode}`,
            ...(needsPlanHint
              ? ["", "현재 크레딧이 없는 상태에요."]
              : []),
            ...(planInterestLabel
              ? [`Plan interest: ${planInterestLabel}`]
              : []),
          ].join("\n")
        : [
            "Booking Done",
            `Booking Code: ${successBookingCode}`,
            ...(needsPlanHint
              ? ["", "현재 크레딧이 없는 상태에요."]
              : []),
            ...(planInterestLabel
              ? [`Plan interest: ${planInterestLabel}`]
              : []),
          ].join("\n");

    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(wasapMessage)}`;

    // Optional: keep a clean visible href (no prefilled text)
    const waPrettyHref = `https://wa.me/${phone}`;

    return (
      <div className="min-h-screen bg-[#FAF8F6] text-[#444444] px-6 py-24">
        <SiteHeader />
        <main className="max-w-2xl mx-auto mt-16">
          <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-8 shadow-sm overflow-hidden">
            <h1 className="font-serif text-3xl font-bold mb-3">
              Booking is ready
            </h1>
            <p className="text-[#5C574F] mb-6">
              Please click the button below and complete your booking.
            </p>
            {signedUpOnBook ? (
              <div className="mb-6 rounded-2xl border border-[#E8DDD4] bg-white px-5 py-4 text-sm text-[#444444]">
                <div className="font-semibold">You&apos;re signed in</div>
                <p className="mt-1 text-[#716D64]">
                  Your account was created with your 4-digit password. Stay signed
                  in on this browser — you won&apos;t need to log in again for a
                  long time.
                </p>
                <Link
                  href="/booking/account"
                  className="inline-flex mt-3 text-sm font-medium text-[#A66A4A] underline underline-offset-4 hover:text-[#444444]"
                >
                  Open my account
                </Link>
              </div>
            ) : null}
            {!!bookedParts && (
              <div className="rounded-2xl border border-[#E8DDD4] bg-white px-5 py-4 text-sm text-[#444444]">
                {!!bookedClassName && (
                  <div className="font-semibold">{bookedClassName}</div>
                )}
                <div
                  className={cn(!!bookedClassName ? "mt-1 text-[#716D64]" : "")}
                >
                  {bookedParts.dateLabel} · {bookedParts.timeRangeLabel}
                </div>
              </div>
            )}
            <div className="mt-4">
              <div className="text-xs text-[#716D64] mb-1">Booking code</div>
              <button
                type="button"
                title={copied ? "Copied" : "Tap to copy"}
                aria-label={
                  copied
                    ? "Booking code copied"
                    : `Copy booking code ${successBookingCode}`
                }
                className={cn(
                  "font-mono text-2xl tracking-widest text-left rounded-xl px-2 py-1 -mx-2",
                  "hover:bg-[#F3ECE6] active:bg-[#E8DDD4] transition cursor-pointer",
                  copied && "text-[#A66A4A]",
                )}
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
                {successBookingCode}
                <span className="sr-only">
                  {copied ? "Copied" : "Tap to copy"}
                </span>
              </button>
              {copied ? (
                <div className="mt-1 text-xs font-medium text-[#A66A4A]">
                  Copied
                </div>
              ) : null}
            </div>

            {needsPlanHint ? (
              <div className="mt-6 min-w-0">
                <label className="grid gap-2 min-w-0">
                  <span className="text-sm font-semibold text-[#444444]">
                    Select your pilates plan.
                  </span>
                  <select
                    value={selectedPlanInterest}
                    onChange={(e) => setSelectedPlanInterest(e.target.value)}
                    className="w-full max-w-full min-w-0 box-border rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
                  >
                    <option value="">Choose a plan…</option>
                    {sortedPlanOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {planPurchaseGroupHeading(p.category)} · {p.title} — RM{" "}
                        {p.priceRm}
                      </option>
                    ))}
                    <option value="__consult__">
                      {"I'll decide after a consultation"}
                    </option>
                    <option value="__event_promo__">Event / promotion</option>
                  </select>
                </label>
              </div>
            ) : null}

            <a
              href={waPrettyHref}
              target="_blank"
              rel="noreferrer"
              aria-disabled={needsPlanHint && !selectedPlanInterest}
              onClick={(e) => {
                e.preventDefault();
                if (needsPlanHint && !selectedPlanInterest) return;
                // Keep the visible/hover URL clean, but open the full prefilled message.
                window.open(waUrl, "_blank", "noopener,noreferrer");
              }}
              className={cn(
                "mt-6 w-full rounded-2xl px-6 py-4",
                "bg-[#25D366] text-black",
                "inline-flex items-center justify-center gap-3",
                "text-base sm:text-lg font-semibold",
                "shadow-sm transition hover:brightness-95",
                needsPlanHint &&
                  !selectedPlanInterest &&
                  "opacity-50 pointer-events-none cursor-not-allowed",
              )}
            >
              <FaWhatsapp className="h-6 w-6" aria-hidden />
              Complete Booking.
            </a>

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
                  setNeedsPlanHint(false);
                  setSelectedPlanInterest("");
                  setPlanOptions([]);
                  setSignedUpOnBook(false);
                  setCopied(false);
                  setEmail("");
                  setWhatsapp("");
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
          <section className="booking-calendar-panel bg-white/70 border border-[#E8DDD4] rounded-3xl p-4 sm:p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h1 className="font-serif text-2xl font-bold">Book a time</h1>
              <Link
                href="/booking/schedule"
                className="inline-flex items-center gap-1.5 shrink-0 pt-0.5 text-xs font-medium text-[#716D64] hover:text-[#444444] transition cursor-pointer"
              >
                <CalendarDaysIcon className="h-4 w-4" aria-hidden />
                View schedule
              </Link>
            </div>

            <div className="-mx-1 sm:mx-0">
              {loadingCalendar ? (
                <BookingCalendarSkeleton month={month} />
              ) : (
                <DayPicker
                  mode="single"
                  selected={selectedDay}
                  onSelect={setSelectedDay}
                  month={month}
                  onMonthChange={setCalendarMonth}
                  weekStartsOn={0}
                  disabled={disabledDays}
                  className="w-full booking-day-picker"
                  classNames={{
                    months: "w-full",
                    month: "w-full",
                    month_grid: "w-full",
                    weekdays: "w-full",
                    week: "w-full",
                  }}
                />
              )}
            </div>
            <div
              className="mt-4 min-h-4"
              aria-live="polite"
              aria-busy={loadingCalendar}
            >
              {loadingCalendar ? (
                <SkeletonLine className="w-44 max-w-full" aria-hidden />
              ) : availableDateKeys.size === 0 ? (
                <p className="text-xs text-[#716D64]">
                  No available dates this month.
                </p>
              ) : (
                <p className="text-xs text-[#716D64]">
                  Pick a date to see available times.
                </p>
              )}
            </div>

            <div className="mt-10 border-t border-[#E8DDD4] pt-5">
              <div className="flex items-center gap-2 mb-3">
                <InformationCircleIcon
                  className="h-5 w-5 shrink-0 text-[#A66A4A]"
                  aria-hidden
                />
                <h2 className="font-serif text-base font-semibold text-[#444444]">
                  Good to know
                </h2>
              </div>
              <div className="space-y-3">
              <div>
                <button
                  type="button"
                  onClick={() => setOpenPrepareInfo((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#716D64] hover:text-[#444444] transition cursor-pointer"
                  aria-expanded={openPrepareInfo}
                >
                  <ChevronDownIcon
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      openPrepareInfo ? "rotate-180" : "",
                    )}
                  />
                  Booking prepare
                </button>
                {openPrepareInfo ? (
                  <div className="mt-2 pl-5 text-xs text-[#716D64] leading-relaxed space-y-1">
                    <div>🧦 Grip socks (if dont have can purchase in studio)</div>
                    <div>🏷️ Mat Towel to cover mattress (optional)</div>
                    <div>👚 Attire: Sport Attire that comfortable</div>
                  </div>
                ) : null}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setOpenNeedToKnow((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#716D64] hover:text-[#444444] transition cursor-pointer"
                  aria-expanded={openNeedToKnow}
                >
                  <ChevronDownIcon
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      openNeedToKnow ? "rotate-180" : "",
                    )}
                  />
                  Something you need to know
                </button>
                {openNeedToKnow ? (
                  <div className="mt-2 pl-5 text-xs text-[#716D64] leading-relaxed space-y-1">
                    <div>
                      ⏳ Cancellation and Refundable can be made 12 hours before
                      the class
                    </div>
                    <div>⏰ Please come 15 minutes early</div>
                    <div>‼️ No Show/Late Cancellation Fee</div>
                    <div className="pl-3">
                      <div>- Group Class RM 10</div>
                      <div>- Private Session RM 20</div>
                    </div>
                  </div>
                ) : null}
              </div>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-serif text-xl font-semibold">Class Type</h2>
                <div className="text-xs text-[#716D64] min-h-4 shrink-0">
                  {loadingCalendar ? (
                    <SkeletonLine
                      className="w-24 max-w-full ml-auto"
                      aria-hidden
                    />
                  ) : dateKey ? (
                    formatBookingDateLabel(dateKey)
                  ) : null}
                </div>
              </div>
              <div className="mt-1 min-h-[1.25rem]">
                {showClassTypeHints ? (
                  <p className="text-sm leading-5 text-[#716D64]">
                    Choose a class type first to see available times.
                  </p>
                ) : (
                  <SkeletonLine
                    className="h-5 w-56 max-w-full"
                    aria-hidden
                  />
                )}
              </div>

              <div className="mt-4">
                <WithLoading
                  loading={classTypesLoading}
                  fallback={<ClassTypeGridSkeleton />}
                >
                  <div className={cn(!dateKey ? "opacity-60" : "")}>
                    {itemsError ? (
                      <div className="text-sm text-red-700">{itemsError}</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
                        {items.map((it) => {
                          const disabled =
                            !dateKey || disabledItemIdsForDate.has(it.id);
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
                              style={
                                !disabled && tinted
                                  ? { backgroundColor: tinted }
                                  : undefined
                              }
                              className={cn(
                                "rounded-3xl border px-5 py-4 text-left transition cursor-pointer h-full relative",
                                disabled
                                  ? "bg-[#FAF8F6] border-[#E8DDD4] opacity-60 cursor-not-allowed"
                                  : "bg-white border-[#E8DDD4] hover:shadow-sm",
                                selected
                                  ? "ring-2 ring-[#A66A4A] ring-offset-2 ring-offset-[#FAF8F6] shadow-sm"
                                  : "",
                              )}
                            >
                              {selected ? (
                                <span className="absolute top-3 right-3 h-6 w-6 rounded-full border border-[#A66A4A] bg-white/80 text-[#A66A4A] flex items-center justify-center text-sm leading-none">
                                  ✓
                                </span>
                              ) : null}
                              <div className="h-full flex flex-col items-start text-left">
                                <div className="flex w-full items-start justify-between gap-3">
                                  <div className="font-serif text-lg font-semibold text-[#444444]">
                                    {it.name}
                                  </div>
                                  {!!it.color && (
                                    <span
                                      className="shrink-0 inline-block h-3 w-3 rounded-full border border-black/10 mt-1.5"
                                      style={{ backgroundColor: it.color }}
                                    />
                                  )}
                                </div>
                                {desc ? (
                                  <p className="mt-1.5 text-[11px] leading-snug text-[#716D64]/70 line-clamp-2">
                                    {desc}
                                  </p>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </WithLoading>
                {showClassTypeHints && !dateKey ? (
                  <div className="mt-2 text-xs text-[#716D64]">
                    Pick a date first.
                  </div>
                ) : showClassTypeHints &&
                  selectedItemId &&
                  disabledItemIdsForDate.has(selectedItemId) ? (
                  <div className="mt-2 text-xs text-[#A66A4A]">
                    No sessions scheduled for this class on the selected date.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-serif text-xl font-semibold cursor-pointer">
                  Available times
                </h2>
                <div className="text-xs text-[#716D64] min-h-4">
                  {!showTimesHints ? (
                    <SkeletonLine className="w-28 max-w-full" aria-hidden />
                  ) : selectedItemId ? (
                    items.find((it) => it.id === selectedItemId)?.name ?? ""
                  ) : null}
                </div>
              </div>
              <div className="mt-1 min-h-4">
                {!showTimesHints ? (
                  <SkeletonLine className="w-40 max-w-full" aria-hidden />
                ) : selectedItemId && !selectedSlotId ? (
                  <p className="text-xs text-[#A66A4A]">
                    Select a time below to continue.
                  </p>
                ) : null}
              </div>

              <SkipUpdate
                block={loadingSlots || loadingCalendar || itemsLoading}
              >
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
                        No sessions scheduled on this date.
                      </div>
                    ) : slots.every((s) => !isSlotSelectable(s)) ? (
                      <div className="mt-5 text-sm text-[#716D64]">
                        No available class on this date.
                      </div>
                    ) : (
                      <div className="mt-5 space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {slots.map((s) => {
                            const label = formatLocalTimeRange(
                              s.startUtc,
                              s.endUtc,
                            );
                            const selected = selectedSlotId === s.id;
                            const itemLabel =
                              s.itemName ??
                              items.find((it) => it.id === s.itemId)?.name ??
                              items.find((it) => it.id === selectedItemId)
                                ?.name ??
                              "";
                            const subtitle = (
                              <span className="inline-flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
                                {!!itemLabel && (
                                  <span className="text-[#716D64]">
                                    {itemLabel}
                                  </span>
                                )}
                                {s.capacity > 1 ? (
                                  <span className="text-[#716D64]">
                                    {!!itemLabel && "· "}
                                    {s.isFull || s.available <= 0
                                      ? "Full"
                                      : `${s.available} ${s.available === 1 ? "spot" : "spots"} left`}
                                  </span>
                                ) : null}
                              </span>
                            );
                            return (
                              <SlotButton
                                key={s.id}
                                disabled={!isSlotSelectable(s)}
                                selected={selected}
                                onClick={() => setSelectedSlotId(s.id)}
                                color={s.itemColor}
                                title={label}
                                subtitle={subtitle}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </WithError>
                </WithLoading>
              </SkipUpdate>
            </div>

            <BookingGuestPanel
              authedClient={authedClient}
              email={email}
              onEmailChange={setEmail}
              whatsapp={whatsapp}
              onWhatsappChange={setWhatsapp}
              signUp={signUp}
              onSignUpChange={(v) => {
                setSignUp(v);
                if (!v) setPassword("");
              }}
              password={password}
              onPasswordChange={setPassword}
              selectedSlotId={selectedSlotId}
              submitting={submitting}
              submitError={submitError}
              onSubmit={() => void submitBooking()}
            />
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
