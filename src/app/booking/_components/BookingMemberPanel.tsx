"use client";

import { useState } from "react";
import Link from "next/link";
import { FaApple } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { Checkbox } from "@/components/Checkbox";
import { cn } from "@/lib/cn";

export type BookingClientMe = {
  authed: boolean;
  needsName?: boolean;
  client?: {
    id: string;
    name: string;
    email: string;
    whatsapp: string;
    studentStatus: "none" | "pending" | "verified" | "rejected";
  };
  balance?: {
    balance: number;
    expiryAlerts?: Array<{
      expiresAt: string;
      windowStart: string;
      windowEnd: string;
      credits: number;
      expiryApproved: boolean;
      showBanner: boolean;
    }>;
  };
};

type Props = {
  clientMe: BookingClientMe;
  clientLoading: boolean;
  authErr?: string | null;
  selectedSlotId: string | null;
  consentWhatsapp: boolean;
  onConsentWhatsappChange: (v: boolean) => void;
  marketingOptIn: boolean;
  onMarketingOptInChange: (v: boolean) => void;
  whatsappOverride: string;
  onWhatsappOverrideChange: (v: string) => void;
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
  onClientRefresh: () => Promise<void>;
  onPersistDraft?: () => void;
};

function authErrMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  const map: Record<string, string> = {
    google_unconfigured: "Google sign-in is not configured yet.",
    apple_unconfigured: "Apple sign-in is not configured yet.",
    google_denied: "Google sign-in was cancelled.",
    google_state: "Google sign-in expired. Please try again.",
    google_token: "Google sign-in failed. Please try again.",
    google_email: "Google did not provide a verified email.",
    google_account: "Could not create your account.",
  };
  return map[code] ?? "Sign-in failed. Please try again.";
}

export function BookingMemberPanel({
  clientMe,
  clientLoading,
  authErr,
  selectedSlotId,
  consentWhatsapp,
  onConsentWhatsappChange,
  marketingOptIn,
  onMarketingOptInChange,
  whatsappOverride,
  onWhatsappOverrideChange,
  submitting,
  submitError,
  onSubmit,
  onClientRefresh,
  onPersistDraft,
}: Props) {
  const [email, setEmail] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [recoverMode, setRecoverMode] = useState(false);
  const [recoverName, setRecoverName] = useState("");
  const [recoverWhatsapp, setRecoverWhatsapp] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const urlAuthErr = authErrMessage(authErr);
  const credits = clientMe.balance?.balance ?? 0;
  const profileWhatsapp = (clientMe.client?.whatsapp ?? "").trim();
  const needsWhatsapp = clientMe.authed && !profileWhatsapp;
  const whatsappReady =
    !!profileWhatsapp ||
    (whatsappOverride.trim().length >= 6 && whatsappOverride.trim().length <= 32);
  const needsName =
    clientMe.authed &&
    (!(clientMe.client?.name ?? "").trim() || clientMe.needsName);
  const canSubmit =
    clientMe.authed &&
    !!selectedSlotId &&
    consentWhatsapp &&
    !needsName &&
    whatsappReady &&
    credits >= 1 &&
    !submitting;

  async function emailSignIn() {
    const trimmed = email.trim();
    if (!trimmed) {
      setAuthError("Enter your email.");
      return;
    }
    if (!/^\d{4}$/.test(authPassword)) {
      setAuthError("Enter your 4-digit password.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/public/client/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          password: authPassword,
          name: authName.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Sign-in failed");
      }
      await onClientRefresh();
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setAuthLoading(false);
    }
  }

  async function recoverAccount() {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/public/client/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: recoverName.trim(),
          whatsapp: recoverWhatsapp.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Account not found");
      }
      await onClientRefresh();
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Account not found");
    } finally {
      setAuthLoading(false);
    }
  }

  function getSubmitLabel(): string {
    if (clientLoading) return "Loading account…";
    if (!clientMe.authed) return "Sign in to book";
    if (!selectedSlotId) return "Select a time";
    if (needsName) return "Add your name";
    if (!whatsappReady) return "Add your WhatsApp";
    if (!consentWhatsapp) return "Agree to WhatsApp updates";
    if (credits < 1) return "Buy credits to book";
    if (submitting) return "Submitting…";
    return "Confirm booking";
  }

  if (clientLoading) {
    return (
      <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
        <div className="text-sm text-[#716D64]">Loading your account…</div>
      </div>
    );
  }

  if (!clientMe.authed) {
    return (
      <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="font-serif text-xl font-semibold">Sign in to book</h2>
        </div>

        {urlAuthErr ? (
          <div className="text-sm text-red-700">{urlAuthErr}</div>
        ) : null}
        {authError ? <div className="text-sm text-red-700">{authError}</div> : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <a
            href="/api/public/client/auth/google"
            onClick={() => onPersistDraft?.()}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-2xl border border-[#E8DDD4]",
              "bg-white px-4 py-3 text-sm font-medium hover:shadow-sm transition",
            )}
          >
            <FcGoogle className="h-5 w-5" aria-hidden />
            Google
          </a>
          <a
            href="/api/public/client/auth/apple"
            onClick={() => onPersistDraft?.()}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-2xl border border-[#E8DDD4]",
              "bg-white px-4 py-3 text-sm font-medium hover:shadow-sm transition",
            )}
          >
            <FaApple className="h-5 w-5" aria-hidden />
            Apple
          </a>
        </div>

        <div className="text-xs text-center text-[#716D64]">or continue with email</div>

        {recoverMode ? (
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">Name on account</span>
              <input
                value={recoverName}
                onChange={(e) => setRecoverName(e.target.value)}
                className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">WhatsApp on account</span>
              <input
                value={recoverWhatsapp}
                onChange={(e) => setRecoverWhatsapp(e.target.value)}
                className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
                inputMode="tel"
              />
            </label>
            <button
              type="button"
              disabled={authLoading}
              onClick={() => void recoverAccount()}
              className="rounded-full bg-[#DFD1C9] px-6 py-3 text-sm font-medium hover:brightness-95 disabled:opacity-50"
            >
              {authLoading ? "Finding account…" : "Find my account"}
            </button>
            <button
              type="button"
              className="text-sm text-[#716D64] underline"
              onClick={() => setRecoverMode(false)}
            >
              Back to email sign-in
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">Email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
                inputMode="email"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">4-digit password</span>
              <input
                value={authPassword}
                onChange={(e) =>
                  setAuthPassword(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm tracking-[0.35em] outline-none focus:ring-2 focus:ring-[#DFD1C9]"
                placeholder="••••"
                inputMode="numeric"
                maxLength={4}
                autoComplete="current-password"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">Name (new accounts)</span>
              <input
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
                placeholder="Your name"
                autoComplete="name"
              />
            </label>
            <button
              type="button"
              disabled={authLoading}
              onClick={() => void emailSignIn()}
              className="rounded-full bg-[#DFD1C9] px-6 py-3 text-sm font-medium hover:brightness-95 disabled:opacity-50"
            >
              {authLoading ? "Signing in…" : "Sign in / create account"}
            </button>
            <button
              type="button"
              className="text-sm text-[#716D64] underline"
              onClick={() => setRecoverMode(true)}
            >
              Find account with name + WhatsApp
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl font-semibold">Your account</h2>
          <div className="mt-2 text-sm text-[#444444]">
            {clientMe.client?.name || "—"}
          </div>
          <div className="text-xs text-[#716D64]">
            {clientMe.client?.email}
            {profileWhatsapp ? ` · ${profileWhatsapp}` : ""}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-2 text-right">
            <div className="text-xs text-[#716D64]">Credits</div>
            <div className="font-serif text-xl font-semibold">{credits}</div>
          </div>
          <div className="flex gap-2 text-xs">
            <Link href="/booking/account" className="text-[#716D64] underline">
              My plans
            </Link>
          </div>
        </div>
      </div>

      {credits < 1 ? (
        <div className="rounded-2xl border border-[#F2D3A2] bg-[#FFFDF8] px-4 py-3 text-sm text-[#444444]">
          You need at least 1 credit to book. Choose a package below and complete
          payment via WhatsApp.
        </div>
      ) : null}

      {needsWhatsapp ? (
        <label className="grid gap-1">
          <span className="text-xs text-[#716D64]">WhatsApp (required for booking)</span>
          <input
            value={whatsappOverride}
            onChange={(e) => onWhatsappOverrideChange(e.target.value)}
            className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
            placeholder="+60 12-345 6789"
            inputMode="tel"
          />
        </label>
      ) : null}

      <div className="rounded-2xl border border-[#E8DDD4] bg-white/70 px-4 py-4 space-y-3">
        <div className="text-xs text-[#716D64] font-medium">Confirm booking</div>
        <Checkbox
          checked={consentWhatsapp}
          onCheckedChange={onConsentWhatsappChange}
          label="Receive booking updates via WhatsApp"
        />
        <Checkbox
          checked={marketingOptIn}
          onCheckedChange={onMarketingOptInChange}
          label="Receive event / promotion updates"
        />
      </div>

      {submitError ? <div className="text-sm text-red-700">{submitError}</div> : null}
      {authError ? <div className="text-sm text-red-700">{authError}</div> : null}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={onSubmit}
        className="w-full rounded-full bg-[#DFD1C9] px-6 py-3 text-sm font-medium hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {getSubmitLabel()}
      </button>
      <div className="text-xs text-[#716D64]">
        One credit is used when you confirm. Cancellations follow studio policy.
      </div>
    </div>
  );
}
