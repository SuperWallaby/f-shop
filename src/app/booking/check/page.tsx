"use client";

import { useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { DateTime } from "luxon";
import ArrowLeftIcon from "@heroicons/react/24/outline/ArrowLeftIcon";
import MagnifyingGlassIcon from "@heroicons/react/24/outline/MagnifyingGlassIcon";
import CalendarDaysIcon from "@heroicons/react/24/outline/CalendarDaysIcon";
import { CancelBookingActions } from "../_components/CancelBookingActions";

type LookupItem = {
  code: string;
  status: "pending" | "confirmed" | "cancelled" | "no_show";
  dateKey: string;
  startMin: number;
  endMin: number;
  className: string;
  startUtc: string;
  endUtc: string;
};

function formatLocalTimeRange(startUtc: string, endUtc: string): string {
  const start = DateTime.fromISO(startUtc, { zone: "utc" }).toLocal();
  const end = DateTime.fromISO(endUtc, { zone: "utc" }).toLocal();
  return `${start.toFormat("h:mm a")} – ${end.toFormat("h:mm a")}`;
}

function formatBookingDate(dateKey: string): string {
  const date = DateTime.fromISO(dateKey);
  return date.isValid ? date.toFormat("ccc, LLL d, yyyy") : dateKey;
}

export default function BookingCheckPage() {
  const [tab, setTab] = useState<"code" | "details">("code");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<LookupItem[]>([]);
  const [cancellingCode, setCancellingCode] = useState<string | null>(null);

  const canLookupByCode = useMemo(() => /^\d{6}$/.test(code.trim()), [code]);
  const canLookupByDetails = useMemo(() => {
    if (!name.trim()) return false;
    return Boolean(email.trim() || whatsapp.trim());
  }, [email, name, whatsapp]);

  async function lookupByCode() {
    const c = code.trim();
    if (!/^\d{6}$/.test(c)) {
      setError("Please enter a 6-digit booking code.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/bookings/lookup?code=${encodeURIComponent(c)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? "Lookup failed");
      setItems((json.data.items ?? []) as LookupItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  async function lookupByDetails() {
    const n = name.trim();
    const e = email.trim();
    const w = whatsapp.trim();
    if (!n || (!e && !w)) {
      setError("Please enter name + (email or WhatsApp).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("name", n);
      if (e) params.set("email", e);
      if (w) params.set("whatsapp", w);
      const res = await fetch(`/api/public/bookings/lookup?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? "Lookup failed");
      setItems((json.data.items ?? []) as LookupItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  async function cancelBooking(targetCode: string) {
    const e = email.trim();
    const w = whatsapp.trim();
    if (!e && !w) {
      setError("To cancel, please provide email or WhatsApp.");
      return;
    }
    setCancellingCode(targetCode);
    setError(null);
    try {
      const res = await fetch("/api/public/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: targetCode, email: e || undefined, whatsapp: w || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? "Cancel failed");

      // Refresh current search
      if (tab === "code") await lookupByCode();
      else await lookupByDetails();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCancellingCode(null);
    }
  }

  return (
    <div className="min-h-screen bg-fasea-canvas text-fasea-tertiary px-6 py-24">
      <SiteHeader />
      <main className="max-w-3xl mx-auto mt-16 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/booking"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-fasea-border bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-fasea-border bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Home
          </Link>
        </div>

        <div className="bg-white/70 border border-fasea-border rounded-3xl p-6 shadow-sm">
          <h1 className="font-serif text-2xl font-bold mb-2">Booking check</h1>
          <div className="text-sm text-fasea-secondary">
            Look up by booking code, or by name + (email / WhatsApp).
          </div>
        </div>

        <section className="bg-white/70 border border-fasea-border rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="font-serif text-lg font-semibold inline-flex items-center gap-2">
              <MagnifyingGlassIcon className="h-4 w-4" />
              Search
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTab("code")}
                className={cn(
                  "px-4 py-2 rounded-full text-sm border transition cursor-pointer",
                  tab === "code"
                    ? "bg-fasea-tonal border-fasea-tonal"
                    : "bg-white/80 border-fasea-border hover:shadow-sm"
                )}
              >
                By code
              </button>
              <button
                type="button"
                onClick={() => setTab("details")}
                className={cn(
                  "px-4 py-2 rounded-full text-sm border transition cursor-pointer",
                  tab === "details"
                    ? "bg-fasea-tonal border-fasea-tonal"
                    : "bg-white/80 border-fasea-border hover:shadow-sm"
                )}
              >
                By details
              </button>
            </div>
          </div>

          {tab === "code" ? (
            <div className="mt-5">
              <label className="grid gap-1">
                <span className="text-xs text-fasea-secondary">
                  Booking code (6 digits)
                </span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  placeholder="123456"
                  className={cn(
                    "rounded-2xl border border-fasea-border bg-white px-4 py-3 text-sm",
                    "outline-none focus:ring-2 focus:ring-fasea-focus"
                  )}
                />
              </label>
              <button
                type="button"
                disabled={!canLookupByCode || loading}
                onClick={lookupByCode}
                className="mt-4 px-6 py-3 rounded-full bg-fasea-tonal text-sm font-medium hover:brightness-95 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Searching…" : "Search"}
              </button>
            </div>
          ) : (
            <div className="mt-5">
              <div className="grid gap-3">
                <label className="grid gap-1">
                  <span className="text-xs text-fasea-secondary">Name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className={cn(
                      "rounded-2xl border border-fasea-border bg-white px-4 py-3 text-sm",
                      "outline-none focus:ring-2 focus:ring-fasea-focus"
                    )}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-fasea-secondary">Email (optional)</span>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    inputMode="email"
                    className={cn(
                      "rounded-2xl border border-fasea-border bg-white px-4 py-3 text-sm",
                      "outline-none focus:ring-2 focus:ring-fasea-focus"
                    )}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-fasea-secondary">
                    WhatsApp (optional)
                  </span>
                  <input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+60 12-345 6789"
                    inputMode="tel"
                    className={cn(
                      "rounded-2xl border border-fasea-border bg-white px-4 py-3 text-sm",
                      "outline-none focus:ring-2 focus:ring-fasea-focus"
                    )}
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={!canLookupByDetails || loading}
                onClick={lookupByDetails}
                className="mt-4 px-6 py-3 rounded-full bg-fasea-tonal text-sm font-medium hover:brightness-95 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Searching…" : "Search"}
              </button>
            </div>
          )}
        </section>

        {!!error && (
          <div className="bg-white/70 border border-red-200 rounded-3xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="bg-white/70 border border-fasea-border rounded-3xl p-6 shadow-sm">
          <div className="flex items-baseline justify-between gap-4">
            <div className="font-serif text-lg font-semibold">Results</div>
            <div className="text-xs text-fasea-secondary">Total: {items.length}</div>
          </div>

          {items.length === 0 ? (
            <div className="mt-4 text-sm text-fasea-secondary">
              No bookings found.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {items.map((b) => (
                <div
                  key={`${b.code}-${b.dateKey}-${b.startMin}`}
                  className="rounded-3xl border border-fasea-border bg-white/80 px-5 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-mono uppercase tracking-wide text-fasea-secondary">
                      Booking #{b.code}
                    </div>
                    <span
                      className={cn(
                        "text-[11px] px-2 py-1 rounded-full",
                        b.status === "pending"
                          ? "bg-[#FFF7E6] text-[#8A5A00]"
                          : b.status === "confirmed"
                          ? "bg-fasea-tonal text-fasea-tertiary"
                          : "bg-[#F3ECE6] text-fasea-secondary"
                      )}
                    >
                      {b.status === "pending"
                        ? "pending studio confirmation"
                        : b.status === "confirmed"
                          ? "confirmed"
                          : b.status === "no_show"
                            ? "no-show"
                            : "cancelled"}
                    </span>
                  </div>
                  <div className="mt-3 font-serif text-xl font-semibold text-[#444444]">
                    {b.className}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#716D64]">
                    <CalendarDaysIcon className="h-4 w-4" aria-hidden />
                    <span>{formatBookingDate(b.dateKey)}</span>
                    <span aria-hidden>·</span>
                    <span>{formatLocalTimeRange(b.startUtc, b.endUtc)}</span>
                  </div>
                  {b.status === "confirmed" && (
                    <CancelBookingActions
                      code={b.code}
                      className={b.className}
                      whenLabel={`${formatBookingDate(b.dateKey)} · ${formatLocalTimeRange(b.startUtc, b.endUtc)}`}
                      startUtc={b.startUtc}
                      cancelling={cancellingCode === b.code}
                      onCancel={() => cancelBooking(b.code)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

