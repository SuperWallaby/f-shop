"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { ClientPhoneAuthPanel } from "./ClientPhoneAuthPanel";

export type BookingGuestAuthedClient = {
  name: string;
  email: string;
  whatsapp: string;
};

type Props = {
  /** When set, details are shown read-only and Sign Up is hidden. */
  authedClient?: BookingGuestAuthedClient | null;
  email: string;
  onEmailChange: (value: string) => void;
  whatsapp: string;
  onWhatsappChange: (value: string) => void;
  signUp: boolean;
  onSignUpChange: (value: boolean) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  selectedSlotId: string | null;
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
  /** Refresh session after phone+PIN sign-in. */
  onClientRefresh?: () => void | Promise<void>;
};

export function BookingGuestPanel({
  authedClient,
  email,
  onEmailChange,
  whatsapp,
  onWhatsappChange,
  signUp,
  onSignUpChange,
  password,
  onPasswordChange,
  selectedSlotId,
  submitting,
  submitError,
  onSubmit,
  onClientRefresh,
}: Props) {
  const [showSignIn, setShowSignIn] = useState(false);
  const loggedIn = Boolean(authedClient);
  const displayEmail = loggedIn ? authedClient!.email : email;
  const displayWhatsapp = loggedIn ? authedClient!.whatsapp : whatsapp;
  const displayName = loggedIn ? authedClient!.name : "";

  const pinOk = loggedIn || !signUp || /^\d{4}$/.test(password);
  const canSubmit =
    !!selectedSlotId &&
    !!displayEmail.trim() &&
    !!displayWhatsapp.trim() &&
    pinOk &&
    !submitting;

  const accountExistsHint =
    !!submitError &&
    /already exists|sign in instead|already registered/i.test(submitError);

  if (!loggedIn && showSignIn) {
    return (
      <div className="space-y-3">
        <ClientPhoneAuthPanel
          onAuthed={async () => {
            setShowSignIn(false);
            await onClientRefresh?.();
          }}
        />
        <button
          type="button"
          onClick={() => setShowSignIn(false)}
          className="w-full text-center text-sm text-[#716D64] underline"
        >
          Book as guest instead
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold">Your details</h2>
        {!loggedIn ? (
          <button
            type="button"
            onClick={() => setShowSignIn(true)}
            className="rounded-full border border-[#E8DDD4] bg-white px-4 py-2 text-sm font-medium text-[#444444] hover:shadow-sm"
          >
            Sign in
          </button>
        ) : (
          <Link
            href="/booking/account"
            className="text-sm text-[#716D64] underline"
          >
            My account
          </Link>
        )}
      </div>
      <div className="grid gap-3">
        {loggedIn ? (
          <div className="rounded-2xl border border-[#E8DDD4] bg-white/80 px-4 py-4 space-y-2">
            {displayName.trim() ? (
              <div>
                <div className="text-xs text-[#716D64]">Name</div>
                <div className="text-sm font-medium text-[#444444]">
                  {displayName}
                </div>
              </div>
            ) : null}
            <div>
              <div className="text-xs text-[#716D64]">Email</div>
              <div className="text-sm text-[#444444] break-all">
                {displayEmail || "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#716D64]">WhatsApp</div>
              <div className="text-sm text-[#444444]">
                {displayWhatsapp || "—"}
              </div>
            </div>
          </div>
        ) : (
          <>
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">Email</span>
              <input
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                className={cn(
                  "rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm",
                  "outline-none focus:ring-2 focus:ring-[#DFD1C9]",
                )}
                placeholder="you@example.com"
                inputMode="email"
                autoComplete="email"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">WhatsApp</span>
              <input
                value={whatsapp}
                onChange={(e) => onWhatsappChange(e.target.value)}
                className={cn(
                  "rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm",
                  "outline-none focus:ring-2 focus:ring-[#DFD1C9]",
                )}
                placeholder="+60 12-345 6789"
                inputMode="tel"
                autoComplete="tel"
              />
            </label>

            <label className="flex items-start gap-3 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={signUp}
                onChange={(e) => onSignUpChange(e.target.checked)}
                className="mt-1 rounded border-[#E8DDD4]"
              />
              <span className="text-sm leading-snug text-[#444444]">
                Sign Up (create PIN while booking)
              </span>
            </label>

            {signUp ? (
              <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">4-digit password</span>
                <input
                  value={password}
                  onChange={(e) => {
                    const next = e.target.value.replace(/\D/g, "").slice(0, 4);
                    onPasswordChange(next);
                  }}
                  className={cn(
                    "rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm tracking-[0.35em]",
                    "outline-none focus:ring-2 focus:ring-[#DFD1C9]",
                  )}
                  placeholder="••••"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={4}
                />
                <span className="text-[11px] text-[#716D64]">
                  Choose any 4 digits.
                </span>
              </label>
            ) : null}
          </>
        )}

        {submitError ? (
          <div className="space-y-2">
            <div className="text-sm text-red-700">{submitError}</div>
            {accountExistsHint && !loggedIn ? (
              <button
                type="button"
                onClick={() => {
                  onSignUpChange(false);
                  setShowSignIn(true);
                }}
                className="text-sm font-medium text-[#A66A4A] underline"
              >
                Sign in with phone + PIN instead
              </button>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
          className="mt-2 w-full rounded-full bg-[#DFD1C9] px-6 py-3 text-sm font-medium hover:brightness-95 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? "Submitting…"
            : !selectedSlotId
              ? "Select a time"
              : loggedIn
                ? "Submit booking"
                : signUp
                  ? "Submit booking & sign up"
                  : "Submit booking"}
        </button>
        <div className="text-xs text-[#716D64]">
          After submit, you&apos;ll see confirmation. Booking updates may be
          sent by email.
        </div>
      </div>
    </div>
  );
}
