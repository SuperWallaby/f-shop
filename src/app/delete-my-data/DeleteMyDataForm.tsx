"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export function DeleteMyDataForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm) {
      setError("Please confirm that you want to request deletion.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/public/data-deletion-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          whatsapp: whatsapp.trim() || undefined,
          message: message.trim() || undefined,
          confirm: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Could not submit request");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit request");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="bg-white/80 border border-[#E8DDD4] rounded-3xl p-6 sm:p-8">
        <h2 className="font-serif text-xl sm:text-2xl font-semibold mb-3">
          Request received
        </h2>
        <p className="text-sm sm:text-base leading-relaxed text-[#5C574F]">
          We received your data deletion request for{" "}
          <strong className="text-[#2C2A27]">{email.trim()}</strong>. Our team
          will review it and contact you if we need to verify your identity.
          Processing usually takes up to 30 days.
        </p>
        <div className="flex flex-wrap gap-3 mt-8">
          <Link
            href="/privacy"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-white/80 border border-[#E8DDD4] text-sm font-medium text-[#2C2A27] shadow-sm transition hover:bg-white"
          >
            Privacy policy
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#2C2A27] text-white text-sm font-medium shadow-sm transition hover:opacity-90"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white/80 border border-[#E8DDD4] rounded-3xl p-6 sm:p-8 space-y-5"
    >
      <div className="space-y-2">
        <label htmlFor="delete-email" className="text-sm font-medium text-[#2C2A27]">
          Email <span className="text-[#716D64]">(required)</span>
        </label>
        <input
          id="delete-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={cn(
            "w-full rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm",
            "outline-none focus:ring-2 focus:ring-[#DFD1C9]",
          )}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <p className="text-xs text-[#716D64]">
          Use the email linked to your Faséa account or bookings.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="delete-name" className="text-sm font-medium text-[#2C2A27]">
          Name <span className="text-[#716D64]">(optional)</span>
        </label>
        <input
          id="delete-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={cn(
            "w-full rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm",
            "outline-none focus:ring-2 focus:ring-[#DFD1C9]",
          )}
          placeholder="Your name"
          autoComplete="name"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="delete-whatsapp"
          className="text-sm font-medium text-[#2C2A27]"
        >
          WhatsApp <span className="text-[#716D64]">(optional)</span>
        </label>
        <input
          id="delete-whatsapp"
          type="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          className={cn(
            "w-full rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm",
            "outline-none focus:ring-2 focus:ring-[#DFD1C9]",
          )}
          placeholder="+60 12-345 6789"
          autoComplete="tel"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="delete-message"
          className="text-sm font-medium text-[#2C2A27]"
        >
          Additional details <span className="text-[#716D64]">(optional)</span>
        </label>
        <textarea
          id="delete-message"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={cn(
            "w-full rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm resize-y min-h-[100px]",
            "outline-none focus:ring-2 focus:ring-[#DFD1C9]",
          )}
          placeholder="Tell us if you use the mobile app, Google Sign-In, or anything else we should know."
        />
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirm}
          onChange={(e) => setConfirm(e.target.checked)}
          className="mt-1 rounded border-[#E8DDD4]"
        />
        <span className="text-sm leading-relaxed text-[#5C574F]">
          I request deletion of my personal data associated with this email from
          Faséa Pilates Studio systems, including the website and mobile app,
          subject to any records we must keep for legal or accounting purposes.
        </span>
      </label>

      {error ? <div className="text-sm text-red-700">{error}</div> : null}

      <button
        type="submit"
        disabled={submitting || !email.trim()}
        className="w-full sm:w-auto rounded-full bg-[#2C2A27] px-8 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {submitting ? "Submitting…" : "Submit deletion request"}
      </button>
    </form>
  );
}
