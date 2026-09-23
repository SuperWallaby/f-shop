"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

type Props = {
  /** Called after a successful login / signup session cookie is set. */
  onAuthed: () => void | Promise<void>;
  className?: string;
  /** Compact styling for embedding under guest booking details. */
  compact?: boolean;
};

type Step = "phone" | "pin";

/**
 * Phone + 4-digit PIN auth (same as the mobile app).
 * Lookup → existing PIN = login; no PIN = create account.
 */
export function ClientPhoneAuthPanel({ onAuthed, className, compact }: Props) {
  const [step, setStep] = useState<Step>("phone");
  const [countryDial, setCountryDial] = useState("60");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [pin, setPin] = useState("");
  const [accountHasPin, setAccountHasPin] = useState(false);
  const [finding, setFinding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function whatsappE164(): string {
    let local = phoneLocal.replace(/[^0-9]/g, "");
    if (local.startsWith("0")) local = local.slice(1);
    return `+${countryDial}${local}`;
  }

  async function continueFromPhone() {
    const local = phoneLocal.replace(/[^0-9]/g, "");
    if (local.length < 8) {
      setError("Enter a valid phone number.");
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/public/client/auth/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ whatsapp: whatsappE164() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Lookup failed");
      }
      setAccountHasPin(Boolean(json.data?.exists && json.data?.hasPassword));
      setStep("pin");
      setFinding(false);
      setPin("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitPin() {
    if (!/^\d{4}$/.test(pin)) {
      setError("Enter a 4-digit PIN.");
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const path = accountHasPin
        ? "/api/public/client/auth/login"
        : "/api/public/client/auth/signup";
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ whatsapp: whatsappE164(), password: pin }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Sign-in failed");
      }
      await onAuthed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function sendTemporaryPin() {
    const local = phoneLocal.replace(/[^0-9]/g, "");
    if (local.length < 8) {
      setError("Enter a valid phone number.");
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/public/client/auth/find-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ whatsapp: whatsappE164() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Could not send PIN");
      }
      setInfo(
        json.data?.message ??
          "If an account exists, a temporary PIN will be sent shortly.",
      );
      setAccountHasPin(true);
      setStep("pin");
      setFinding(false);
      setPin("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send PIN");
    } finally {
      setLoading(false);
    }
  }

  function back() {
    setError(null);
    setInfo(null);
    if (finding) {
      setFinding(false);
      return;
    }
    if (step === "pin") {
      setStep("phone");
      setPin("");
      setAccountHasPin(false);
    }
  }

  const headline = finding
    ? "Find password"
    : step === "phone"
      ? "Sign in"
      : accountHasPin
        ? "Enter your PIN"
        : "Create your account";

  const subtitle = finding
    ? "We’ll send a temporary PIN to this WhatsApp number."
    : step === "phone"
      ? compact
        ? null
        : "Use your WhatsApp number and 4-digit PIN (same as the app)."
      : accountHasPin
        ? "Enter the 4-digit PIN for this phone number."
        : "No account found for this number yet. Set a 4-digit PIN to create one.";

  return (
    <div
      className={cn(
        "rounded-3xl border border-[#E8DDD4] bg-white/70 shadow-sm",
        compact ? "p-5" : "p-6",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold">{headline}</h2>
        {step === "pin" || finding ? (
          <button
            type="button"
            onClick={back}
            disabled={loading}
            className="text-sm text-[#716D64] underline disabled:opacity-50"
          >
            Back
          </button>
        ) : null}
      </div>
      {subtitle ? (
        <p className="mt-1 text-sm text-[#716D64]">{subtitle}</p>
      ) : null}

      <div className="mt-4 grid gap-3">
        {finding || step === "phone" ? (
          <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">Phone</span>
            <div className="flex gap-2">
              <select
                value={countryDial}
                disabled={loading}
                onChange={(e) => setCountryDial(e.target.value)}
                className="rounded-2xl border border-[#E8DDD4] bg-white px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#DFD1C9]"
              >
                <option value="60">+60</option>
                <option value="65">+65</option>
                <option value="62">+62</option>
                <option value="66">+66</option>
              </select>
              <input
                value={phoneLocal}
                onChange={(e) =>
                  setPhoneLocal(e.target.value.replace(/[^\d\s-]/g, ""))
                }
                disabled={loading}
                className="min-w-0 flex-1 rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
                placeholder="12-345 6789"
                inputMode="tel"
                autoComplete="tel-national"
              />
            </div>
          </label>
        ) : (
          <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">4-digit PIN</span>
            <input
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              disabled={loading}
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm tracking-[0.35em] outline-none focus:ring-2 focus:ring-[#DFD1C9]"
              placeholder="••••"
              inputMode="numeric"
              maxLength={4}
              autoComplete="one-time-code"
            />
          </label>
        )}

        {info ? <div className="text-sm text-[#A66A4A]">{info}</div> : null}
        {error ? <div className="text-sm text-red-700">{error}</div> : null}

        <button
          type="button"
          disabled={loading}
          onClick={() => {
            if (finding) void sendTemporaryPin();
            else if (step === "phone") void continueFromPhone();
            else void submitPin();
          }}
          className="rounded-full bg-[#DFD1C9] px-6 py-3 text-sm font-medium hover:brightness-95 disabled:opacity-50"
        >
          {loading
            ? "Please wait…"
            : finding
              ? "Send temporary PIN"
              : step === "phone"
                ? "Continue"
                : accountHasPin
                  ? "Sign in"
                  : "Create account"}
        </button>

        {step === "pin" && accountHasPin && !finding ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setFinding(true);
              setError(null);
              setInfo(null);
            }}
            className="text-sm text-[#716D64] underline disabled:opacity-50"
          >
            Find password
          </button>
        ) : null}
      </div>
    </div>
  );
}
