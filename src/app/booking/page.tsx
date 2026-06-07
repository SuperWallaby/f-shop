"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
import ChevronDownIcon from "@heroicons/react/24/outline/ChevronDownIcon";
import { FaApple, FaWhatsapp } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import {
  buildCustomerBookingConfirmationMessage,
  formatKlParts,
} from "@/lib/bookingMessages";
import { normalizeHexColor } from "@/lib/itemColor";
import {
  PlanPurchaseSection,
  PlanPurchaseWhatsAppLead,
} from "@/components/PlanPurchaseSection";
import { CreditExpiryBannerStack } from "@/components/CreditExpiryBannerStack";
import { usePlanPurchase } from "@/hooks/usePlanPurchase";

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

/** wa.me expects country code + number without "+" or spaces — same number as WhatsAppCTA/site. */
const STUDIO_WHATSAPP_WA_ME_NUMBER = "60145403560";
/** Malay — legacy members asking to migrate remaining session credits. */
const LEGACY_MEMBER_CREDIT_TRANSFER_MESSAGE_MS =
  "Saya ahli Fasea yang telah mendaftar sebelum ini. Sila bantu pindahkan baki kredit sesi yang tinggal kepada akaun saya.";
const LEGACY_MEMBER_WHATSAPP_HREF = `https://wa.me/${STUDIO_WHATSAPP_WA_ME_NUMBER}?text=${encodeURIComponent(
  LEGACY_MEMBER_CREDIT_TRANSFER_MESSAGE_MS,
)}`;

type ClientMeAuthed = {
  authed: true;
  needsName: boolean;
  client: {
    id: string;
    name: string;
    email: string;
    whatsapp: string;
    studentStatus: "none" | "pending" | "verified" | "rejected";
  };
  balance: {
    balance: number;
    expiringCredits: Array<{
      amount: number;
      expiresAt: string | Date;
      source: string;
    }>;
    expiryAlerts?: Array<{
      expiresAt: string;
      windowStart: string;
      windowEnd: string;
      credits: number;
      expiryApproved: boolean;
      showBanner: boolean;
      ledgerIds: string[];
    }>;
  };
};

type ClientMeState = { authed: false } | ClientMeAuthed;

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
    () => new Set(),
  );
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [allSlots, setAllSlots] = useState<SlotDto[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState("");
  const [consentWhatsapp, setConsentWhatsapp] = useState(true);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successBookingCode, setSuccessBookingCode] = useState<string | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [openPrepareInfo, setOpenPrepareInfo] = useState(false);
  const [openNeedToKnow, setOpenNeedToKnow] = useState(false);

  const [meBoot, setMeBoot] = useState(true);
  const [me, setMe] = useState<ClientMeState>({ authed: false });
  const [loginEmail, setLoginEmail] = useState("");
  const [loginName, setLoginName] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authFormError, setAuthFormError] = useState<string | null>(null);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);

  const planPurchase = usePlanPurchase({
    enabled:
      me.authed === true && !me.needsName && (me.balance?.balance ?? 0) < 1,
  });

  const reloadMe = useCallback(async () => {
    try {
      const res = await fetch("/api/public/client/me", { cache: "no-store" });
      const json = await res.json();
      if (json?.ok && json.data?.authed) {
        setMe({
          authed: true,
          needsName: Boolean(json.data.needsName),
          client: json.data.client,
          balance: json.data.balance,
        });
      } else {
        setMe({ authed: false });
      }
    } catch {
      setMe({ authed: false });
    } finally {
      setMeBoot(false);
    }
  }, []);

  useEffect(() => {
    void reloadMe();
  }, [reloadMe]);

  useEffect(() => {
    if (me.authed && !me.needsName) {
      setWhatsapp((me.client.whatsapp ?? "").trim());
    }
  }, [me]);

  const authErrParam = searchParams.get("authErr");
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

          // If no day selected yet, auto-select the first available date (or today if available).
          if (!selectedDay) {
            const todayKey = DateTime.now()
              .setZone(BUSINESS_TIME_ZONE)
              .toISODate()!;
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
        const res = await fetch(
          `/api/public/slots?dateKey=${encodeURIComponent(dateKey)}`,
        );
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

    const trimmedWhatsapp = whatsapp.trim();

    const whatsappOk =
      trimmedWhatsapp.length >= 8 &&
      trimmedWhatsapp.length <= 32 &&
      /^[+0-9][0-9\s()-]*$/.test(trimmedWhatsapp);

    if (!whatsappOk) {
      setSubmitError("Please enter a valid WhatsApp number.");
      return;
    }
    if (!consentWhatsapp) {
      setSubmitError(
        "Please agree to receive booking-related updates via WhatsApp.",
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          slotId: selectedSlotId,
          whatsapp: trimmedWhatsapp,
          consentWhatsapp: true as const,
          marketingOptIn: Boolean(marketingOptIn),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Booking failed");
      }
      setSuccessBookingCode(json.data.bookingCode);
      await reloadMe();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  function getSubmitBookingLabel(): string {
    if (submitting) return "Submitting…";
    if (!selectedSlotId) return "Select a time";
    if (!whatsapp.trim()) return "Enter your WhatsApp";
    if (!consentWhatsapp) return "Agree to WhatsApp updates";
    return "Submit booking";
  }

  if (meBoot) {
    return (
      <div className="min-h-screen bg-fasea-canvas text-fasea-tertiary px-6 py-24">
        <SiteHeader />
        <main className="max-w-2xl mx-auto mt-16 text-sm text-fasea-secondary">
          Loading…
        </main>
      </div>
    );
  }

  if (!me.authed) {
    return (
      <div className="min-h-screen bg-fasea-canvas text-fasea-tertiary px-6 py-24">
        <SiteHeader />
        <main className="max-w-md mx-auto mt-16 space-y-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-fasea-border bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </Link>
          <div className="rounded-3xl border border-fasea-border bg-white/70 p-8 shadow-sm">
            <h1 className="font-serif text-2xl font-bold">Book with Fasea</h1>
            <p className="mt-2 text-sm text-fasea-secondary">
              Sign in to continue — same steps as signing up (no separate
              account). We keep you signed in so you won’t have to do this
              often.
            </p>
            {authErrParam ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800">
                Sign-in interrupted ({authErrParam}). Please try Apple or Google
                again or continue with email.
              </div>
            ) : null}
            <div className="mt-6 flex flex-col gap-3">
              <a
                href="/api/public/client/auth/apple"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:brightness-110"
              >
                <FaApple className="h-5 w-5 shrink-0" aria-hidden />
                Continue with Apple
              </a>
              <a
                href="/api/public/client/auth/google"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-fasea-border bg-white px-4 py-3 text-sm font-medium text-fasea-tertiary shadow-sm transition hover:shadow-md"
              >
                <FcGoogle className="h-5 w-5 shrink-0" aria-hidden />
                Continue with Google
              </a>
            </div>
            <div className="my-6 flex items-center gap-3 text-sm text-fasea-secondary">
              <span className="flex-1 border-t border-fasea-border" />
              or email
              <span className="flex-1 border-t border-fasea-border" />
            </div>
            <form
              className="space-y-3"
              onSubmit={async (ev) => {
                ev.preventDefault();
                const em = loginEmail.trim();
                const nm = loginName.trim();
                if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
                  setAuthFormError("Please enter a valid email.");
                  return;
                }
                setAuthBusy(true);
                setAuthFormError(null);
                try {
                  const res = await fetch("/api/public/client/auth/request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                      email: em,
                      ...(nm ? { name: nm } : {}),
                    }),
                  });
                  const json = await res.json();
                  if (!res.ok || !json?.ok) {
                    throw new Error(
                      json?.error?.message ?? "Could not continue",
                    );
                  }
                  await reloadMe();
                  setLoginEmail("");
                  setLoginName("");
                } catch (err) {
                  setAuthFormError(
                    err instanceof Error ? err.message : "Could not continue",
                  );
                } finally {
                  setAuthBusy(false);
                }
              }}
            >
              <label className="grid gap-1">
                <span className="text-xs text-fasea-secondary">Email</span>
                <input
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="rounded-2xl border border-fasea-border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-fasea-focus"
                  inputMode="email"
                  placeholder="you@example.com"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-fasea-secondary">Name</span>
                <input
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  className="rounded-2xl border border-fasea-border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-fasea-focus"
                />
              </label>
              {authFormError ? (
                <div className="text-sm text-red-700">{authFormError}</div>
              ) : null}
              <button
                type="submit"
                disabled={authBusy}
                className="w-full rounded-full bg-fasea-tonal px-6 py-3 text-sm font-medium hover:brightness-95 transition disabled:opacity-50 cursor-pointer"
              >
                {authBusy ? "Continuing…" : "Continue"}
              </button>
            </form>
            <div className="mt-8 border-t border-fasea-border/80 pt-6">
              <div className="text-xs font-semibold text-fasea-secondary">
                Already enrolled with us?
              </div>
              <p className="mt-2 text-xs text-fasea-secondary">
                If you joined Fasea before this online account, message us on
                WhatsApp and we’ll help move your remaining session credits.
              </p>
              <a
                href={LEGACY_MEMBER_WHATSAPP_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#C8E6D4] bg-[#F3FAF6] px-4 py-3 text-sm font-medium text-[#2D5F45] shadow-sm transition hover:bg-[#E8F3EC]"
              >
                <FaWhatsapp className="h-5 w-5 shrink-0 text-[#25D366]" aria-hidden />
                Contact us
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (me.authed && me.needsName) {
    return (
      <div className="min-h-screen bg-fasea-canvas text-fasea-tertiary px-6 py-24">
        <SiteHeader />
        <main className="max-w-md mx-auto mt-16 space-y-6">
          <button
            type="button"
            className="text-sm text-fasea-secondary underline cursor-pointer hover:text-fasea-tertiary"
            onClick={async () => {
              await fetch("/api/public/client/logout", {
                method: "POST",
                credentials: "include",
              });
              await reloadMe();
            }}
          >
            Use a different login
          </button>
          <div className="rounded-3xl border border-fasea-border bg-white/70 p-8 shadow-sm">
            <h1 className="font-serif text-2xl font-bold">
              Tell us how to greet you
            </h1>
            <p className="mt-2 text-sm text-fasea-secondary">
              One display name helps us personalize confirmations.
            </p>
            <label className="mt-6 grid gap-1">
              <span className="text-xs text-fasea-secondary">Name</span>
              <input
                value={profileNameDraft}
                onChange={(e) => setProfileNameDraft(e.target.value)}
                className="rounded-2xl border border-fasea-border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-fasea-focus"
                placeholder="Your name"
              />
            </label>
            <button
              type="button"
              disabled={profileBusy || !profileNameDraft.trim()}
              onClick={async () => {
                const n = profileNameDraft.trim();
                if (!n) return;
                setProfileBusy(true);
                setAuthFormError(null);
                try {
                  const res = await fetch("/api/public/client/profile", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ name: n }),
                  });
                  const json = await res.json();
                  if (!res.ok || !json?.ok) {
                    throw new Error(json?.error?.message ?? "Could not save");
                  }
                  await reloadMe();
                  setProfileNameDraft("");
                } catch (err) {
                  setAuthFormError(
                    err instanceof Error ? err.message : "Could not save",
                  );
                } finally {
                  setProfileBusy(false);
                }
              }}
              className="mt-6 w-full rounded-full bg-fasea-tonal px-6 py-3 text-sm font-medium hover:brightness-95 transition disabled:opacity-50 cursor-pointer"
            >
              {profileBusy ? "Saving…" : "Continue"}
            </button>
            {authFormError ? (
              <div className="mt-3 text-sm text-red-700">{authFormError}</div>
            ) : null}
          </div>
        </main>
      </div>
    );
  }

  const creditsBalance = me.authed ? (me.balance?.balance ?? 0) : 0;
  const canSchedule = me.authed && creditsBalance >= 1;

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
            name: me.authed ? me.client.name.trim() || "Member" : "Member",
            classTypeName: bookedClassName,
            bookingCode: successBookingCode,
            dateKey: bookedSlot.dateKey,
            startMin: bookedSlot.startMin,
            endMin: bookedSlot.endMin,
            tz: BUSINESS_TIME_ZONE,
          })
        : "";

    const wasapMessage =
      bookedParts && bookedClassName
        ? [
            "Booking Done",
            `Class: ${bookedClassName}`,
            `Date: ${bookedParts.dateLabel}`,
            `Time: ${bookedParts.timeLabel}`,
            `Booking Code: ${successBookingCode}`,
          ].join("\n")
        : ["Booking Done", `Booking Code: ${successBookingCode}`].join("\n");

    // Replace wasap.my with official WhatsApp deep link (wa.me)
    const phone = "60145403560"; // country code + number, NO "+" and NO spaces
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(wasapMessage)}`;

    // Optional: keep a clean visible href (no prefilled text)
    const waPrettyHref = `https://wa.me/${phone}`;

    return (
      <div className="min-h-screen bg-fasea-canvas text-fasea-tertiary px-6 py-24">
        <SiteHeader />
        <main className="max-w-2xl mx-auto mt-16">
          <div className="bg-white/70 border border-fasea-border rounded-3xl p-8 shadow-sm">
            <h1 className="font-serif text-3xl font-bold mb-3">
              Booking is ready
            </h1>
            <p className="text-[#5C574F] mb-6">
              Please click the button below and complete your booking.
            </p>
            {!!bookedParts && (
              <div className="rounded-2xl border border-fasea-border bg-white px-5 py-4 text-sm text-fasea-tertiary">
                {!!bookedClassName && (
                  <div className="font-semibold">{bookedClassName}</div>
                )}
                <div
                  className={cn(!!bookedClassName ? "mt-1 text-fasea-secondary" : "")}
                >
                  {bookedParts.dateLabel} · {bookedParts.timeRangeLabel}
                </div>
              </div>
            )}
            <div className="mt-2">
              <div className="text-xs text-fasea-secondary mb-1">Booking code</div>
              <div className="flex items-center gap-3">
                <div className="font-mono text-2xl tracking-widest">
                  {successBookingCode}
                </div>
                <button
                  type="button"
                  className="px-3 py-2 rounded-full border border-fasea-border bg-white/80 text-xs hover:shadow-sm transition cursor-pointer"
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

            <a
              href={waPrettyHref}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                // Keep the visible/hover URL clean, but open the full prefilled message.
                e.preventDefault();
                window.open(waUrl, "_blank", "noopener,noreferrer");
              }}
              className={cn(
                "mt-6 w-full rounded-2xl px-6 py-4",
                "bg-[#25D366] text-black",
                "inline-flex items-center justify-center gap-3",
                "text-base sm:text-lg font-semibold",
                "shadow-sm transition hover:brightness-95",
              )}
            >
              <FaWhatsapp className="h-6 w-6" aria-hidden />
              Complete Booking.
            </a>

            <div className="mt-6 rounded-2xl border border-fasea-border bg-white/70 px-5 py-4">
              <div className="text-xs text-fasea-secondary font-medium mb-2">
                Before you come
              </div>
              <pre className="whitespace-pre-wrap leading-loose text-sm text-fasea-tertiary">
                {confirmationText}
              </pre>
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                className="mt-8 px-6 py-3 rounded-full bg-fasea-tonal text-sm font-medium hover:brightness-95 transition cursor-pointer"
                onClick={() => {
                  setSuccessBookingCode(null);
                  setCopied(false);
                  setWhatsapp("");
                  setConsentWhatsapp(true);
                  setMarketingOptIn(false);
                  setSelectedSlotId(null);
                  void reloadMe();
                }}
              >
                Make another booking
              </button>
              <Link
                href="/booking/check"
                className="mt-3 inline-flex items-center gap-2 text-sm text-fasea-secondary underline hover:text-fasea-tertiary cursor-pointer"
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
    <div className="min-h-screen bg-fasea-canvas text-fasea-tertiary px-6 py-24">
      <SiteHeader />

      <main className="max-w-5xl mx-auto mt-16">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-fasea-border bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/booking/check"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-fasea-border bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
            >
              <MagnifyingGlassIcon className="h-4 w-4" />
              Booking check
            </Link>
            {me.authed ? (
              <>
                <Link
                  href="/booking/account"
                  className="inline-flex items-center rounded-full border border-fasea-border bg-white/80 px-4 py-2 text-xs font-medium text-fasea-tertiary hover:shadow-sm transition cursor-pointer"
                >
                  {me.client.name}
                </Link>
                <button
                  type="button"
                  className="rounded-full border border-fasea-border bg-white/80 px-4 py-2 text-xs hover:shadow-sm transition cursor-pointer"
                  onClick={async () => {
                    await fetch("/api/public/client/logout", {
                      method: "POST",
                      credentials: "include",
                    });
                    await reloadMe();
                  }}
                >
                  Log out
                </button>
              </>
            ) : null}
          </div>
        </div>

        {me.authed ? (
          <CreditExpiryBannerStack alerts={me.balance.expiryAlerts ?? []} />
        ) : null}

        {!canSchedule ? (
          <div className="mx-auto mb-12 max-w-3xl space-y-6">
            <PlanPurchaseSection
              studentStatus={me.authed ? me.client.studentStatus : "none"}
              plans={planPurchase.plans}
              plansLoading={planPurchase.plansLoading}
              planOrderLoading={planPurchase.planOrderLoading}
              orderError={planPurchase.orderError}
              onPay={planPurchase.payForPlan}
              title="Packages & credits"
              description={
                <PlanPurchaseWhatsAppLead beforeSend="Choose a bundle and" />
              }
            />
            <div className="rounded-3xl border border-fasea-border bg-white/70 px-6 py-5 text-center text-sm text-fasea-secondary shadow-sm">
              Once payment is confirmed, credits show up automatically. Refresh
              after the studio notifies you, then schedule your class below.
            </div>
          </div>
        ) : null}

        {canSchedule ? (
          <div className="grid gap-10 md:grid-cols-[360px_1fr]">
            <section className="bg-white/70 border border-fasea-border rounded-3xl p-6 shadow-sm">
              <h1 className="font-serif text-2xl font-bold mb-4">
                Book a time
              </h1>

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
              <div className="text-xs text-fasea-secondary mt-4">
                {availabilityHint}
              </div>

              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-fasea-border bg-white/50">
                  <button
                    type="button"
                    onClick={() => setOpenPrepareInfo((v) => !v)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                    aria-expanded={openPrepareInfo}
                  >
                    <div className="text-xs font-medium text-fasea-secondary">
                      Booking prepare
                    </div>
                    <ChevronDownIcon
                      className={cn(
                        "h-4 w-4 text-fasea-secondary transition-transform",
                        openPrepareInfo ? "rotate-180" : "",
                      )}
                    />
                  </button>
                  {openPrepareInfo ? (
                    <div className="px-4 pb-4 text-sm text-fasea-tertiary">
                      <div className="text-xs text-fasea-secondary">
                        Things need to bring
                      </div>
                      <div className="mt-2 space-y-1.5">
                        <div>
                          🧦Grip socks (if dont have can purchase in studio)
                        </div>
                        <div>🏷️ Mat Towel to cover mattress (optional)</div>
                        <div>👚Attire : Sport Attire that comfortable</div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-fasea-border bg-white/50">
                  <button
                    type="button"
                    onClick={() => setOpenNeedToKnow((v) => !v)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                    aria-expanded={openNeedToKnow}
                  >
                    <div className="text-xs font-medium text-fasea-secondary">
                      Something you need to know
                    </div>
                    <ChevronDownIcon
                      className={cn(
                        "h-4 w-4 text-fasea-secondary transition-transform",
                        openNeedToKnow ? "rotate-180" : "",
                      )}
                    />
                  </button>
                  {openNeedToKnow ? (
                    <div className="px-4 pb-4 text-sm text-fasea-tertiary">
                      <div className="space-y-1.5">
                        <div>
                          ⏳Cancellation and Refundable can be made 12 hours
                          before the class
                        </div>
                        <div>⏰ Please come 15 minutes early</div>
                        <div>‼️No Show/Late Cancellation Fee</div>
                        <div className="pl-4">
                          <div>- Group Class RM 10</div>
                          <div>- Private Session RM 20</div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="bg-white/70 border border-fasea-border rounded-3xl p-6 shadow-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-serif text-xl font-semibold">
                    Class Type
                  </h2>
                  <div className="text-xs text-fasea-secondary">{dateKey ?? ""}</div>
                </div>
                <div className="mt-1 text-sm text-fasea-secondary">
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
                                    ? "bg-fasea-canvas border-fasea-border opacity-60 cursor-not-allowed"
                                    : "bg-white border-fasea-border hover:shadow-sm",
                                  selected
                                    ? "ring-2 ring-fasea-primary ring-offset-2 ring-offset-fasea-canvas shadow-sm"
                                    : "",
                                )}
                              >
                                {selected ? (
                                  <span className="absolute top-3 right-3 h-6 w-6 rounded-full border border-fasea-primary bg-white/80 text-fasea-primary flex items-center justify-center text-sm leading-none">
                                    ✓
                                  </span>
                                ) : null}
                                <div className="h-full flex flex-col">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="font-serif text-lg font-semibold text-fasea-tertiary">
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
                    <div className="mt-2 text-xs text-fasea-secondary">
                      Pick a date first.
                    </div>
                  ) : selectedItemId &&
                    disabledItemIdsForDate.has(selectedItemId) ? (
                    <div className="mt-2 text-xs text-fasea-primary">
                      No sessions for this class on the selected date.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="bg-white/70 border border-fasea-border rounded-3xl p-6 shadow-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-serif text-xl font-semibold cursor-pointer">
                    Available times
                  </h2>
                  <div className="text-xs text-fasea-secondary">
                    {selectedItemId
                      ? (items.find((it) => it.id === selectedItemId)?.name ??
                        "")
                      : ""}
                  </div>
                </div>
                {selectedItemId && !selectedSlotId ? (
                  <div className="mt-1 text-xs text-fasea-primary">
                    Select a time below to continue.
                  </div>
                ) : null}

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
                        <div className="mt-5 text-sm text-fasea-secondary">
                          Choose a class type above.
                        </div>
                      ) : slots.length === 0 ? (
                        <div className="mt-5 text-sm text-fasea-secondary">
                          No sessions on this date.
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
                                    <span className="text-fasea-secondary">
                                      {itemLabel}
                                    </span>
                                  )}
                                  {s.capacity > 1 ? (
                                    <span className="text-fasea-secondary">
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
                              <div className="text-xs text-fasea-secondary mb-1">
                                Class Description
                              </div>
                              {itemsLoading ? (
                                <div className="space-y-2">
                                  <Skeleton
                                    className="h-4 w-48"
                                    rounded="rounded-full"
                                  />
                                  <Skeleton
                                    className="h-20 w-full"
                                    rounded="rounded-2xl"
                                  />
                                </div>
                              ) : (
                                <div className="whitespace-pre-wrap rounded-2xl border border-fasea-border bg-white px-4 py-3 text-sm text-fasea-tertiary">
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

              <div className="bg-white/70 border border-fasea-border rounded-3xl p-6 shadow-sm">
                <h2 className="font-serif text-xl font-semibold mb-4">
                  Confirm & WhatsApp
                </h2>
                <div className="rounded-2xl border border-fasea-border bg-white px-4 py-3 text-sm">
                  <div className="text-xs text-fasea-secondary">Profile</div>
                  <div className="font-medium text-fasea-tertiary">
                    {me.client.name}
                  </div>
                  <div className="mt-1 text-xs text-fasea-secondary break-all">
                    {me.client.email}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 items-center justify-between border-t border-fasea-border/80 pt-3">
                    <span className="text-xs text-fasea-secondary">
                      Credits after this booking
                    </span>
                    <span className="font-serif font-semibold text-fasea-tertiary">
                      {Math.max(0, creditsBalance - 1)} left
                    </span>
                  </div>
                </div>
                <label className="grid gap-1 mt-4">
                  <span className="text-xs text-fasea-secondary">
                    WhatsApp for class updates
                  </span>
                  <input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className={cn(
                      "rounded-2xl border border-fasea-border bg-white px-4 py-3 text-sm",
                      "outline-none focus:ring-2 focus:ring-fasea-focus",
                    )}
                    placeholder="+60 12-345 6789"
                    inputMode="tel"
                  />
                </label>

                <div className="mt-2 rounded-2xl border border-fasea-border bg-white/70 px-4 py-4 space-y-3">
                  <div className="text-xs text-fasea-secondary font-medium">
                    Agreements
                  </div>
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
                    whatsapp.trim().length < 8 ||
                    !consentWhatsapp ||
                    submitting
                  }
                  onClick={submitBooking}
                  className="mt-2 px-6 py-3 rounded-full bg-fasea-tonal text-sm font-medium hover:brightness-95 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {getSubmitBookingLabel()}
                </button>
              </div>
            </section>
          </div>
        ) : null}

        <div className="mt-8 flex justify-center">
          <Link
            href="/admin"
            className="text-xs text-fasea-secondary underline hover:text-fasea-tertiary cursor-pointer"
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
        <div className="min-h-screen bg-fasea-canvas text-fasea-tertiary px-6 py-24">
          <SiteHeader />
          <main className="max-w-2xl mx-auto mt-16 text-sm text-fasea-secondary">
            Loading…
          </main>
        </div>
      }
    >
      <BookingPageInner />
    </Suspense>
  );
}
