"use client";

import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";

type Props = {
  email?: string;
  onSaved: () => Promise<void>;
};

export function CompleteNameGate({ email, onSaved }: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter your name to continue.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/public/client/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Could not save name");
      }
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save name");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F6] text-[#444444] px-6 py-24">
      <SiteHeader />
      <main className="max-w-md mx-auto mt-16">
        <div className="rounded-3xl border border-[#E8DDD4] bg-white/70 p-8 shadow-sm">
          <p className="text-sm tracking-[0.2em] uppercase text-[#A66A4A]">
            Almost there
          </p>
          <h1 className="mt-2 font-serif text-3xl font-bold">Your name</h1>
          <p className="mt-3 text-sm text-[#716D64]">
            We use this on bookings and messages. Please add it before continuing.
          </p>
          {email ? (
            <p className="mt-2 text-xs text-[#716D64]">Signed in as {email}</p>
          ) : null}
          <label className="mt-6 grid gap-1">
            <span className="text-xs text-[#716D64]">Full name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
              }}
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
              placeholder="Your name"
            />
          </label>
          {error ? <div className="mt-3 text-sm text-red-700">{error}</div> : null}
          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={() => void save()}
            className="mt-6 w-full rounded-full bg-[#DFD1C9] px-6 py-3 text-sm font-medium hover:brightness-95 transition disabled:opacity-50"
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </div>
      </main>
    </div>
  );
}
