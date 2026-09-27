"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";
import {
  readPendingBookingCodes,
  writePendingBookingCodes,
} from "@/lib/pendingBookingReminder";

type PendingReminder = {
  code: string;
  className: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  resumeHref: string;
};

function formatMin(min: number): string {
  const hour = Math.floor(min / 60);
  const minute = min % 60;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${
    hour >= 12 ? "PM" : "AM"
  }`;
}

function dismissedKey(code: string): string {
  return `fasea.pending-reminder-dismissed.${code}`;
}

export default function PendingBookingToast() {
  const pathname = usePathname();
  const [reminder, setReminder] = useState<PendingReminder | null>(null);

  const refresh = useCallback(async () => {
    const codes = readPendingBookingCodes();
    try {
      const res = await fetch("/api/public/bookings/pending-reminders", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) return;

      writePendingBookingCodes(
        (json.data?.activeStoredCodes ?? []) as string[],
      );
      const items = (json.data?.items ?? []) as PendingReminder[];
      const currentResume =
        typeof window === "undefined"
          ? ""
          : new URLSearchParams(window.location.search).get("resume") ?? "";
      const next =
        items.find(
          (item) =>
            item.code !== currentResume &&
            window.sessionStorage.getItem(dismissedKey(item.code)) !== "1",
        ) ?? null;
      setReminder(next);
    } catch {
      // A reminder must never interrupt normal site use.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const onFocus = () => void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  if (!reminder) return null;

  return (
    <aside
      className="fasea-pending-toast fixed inset-x-0 top-24 z-[60] flex justify-center px-4 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto w-full max-w-xl rounded-3xl border px-5 py-4 shadow-2xl"
        style={{ borderColor: "#E8DDD4", background: "#ffffff" }}
      >
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold" style={{ color: "#444444" }}>
              You have an unfinished booking
            </div>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "#716D64" }}>
              {reminder.className} · {reminder.dateKey} ·{" "}
              {formatMin(reminder.startMin)}–{formatMin(reminder.endMin)}
            </p>
            <p className="mt-1 text-xs" style={{ color: "#C62828" }}>
              Send the WhatsApp message so the studio can confirm it.
            </p>
            <Link
              href={reminder.resumeHref}
              onClick={() => setReminder(null)}
              className="mt-3 inline-flex rounded-full px-4 py-2 text-sm font-semibold hover:brightness-95"
              style={{ background: "#25D366", color: "#111111" }}
            >
              Complete booking
            </Link>
          </div>
          <button
            type="button"
            aria-label="Dismiss pending booking reminder"
            onClick={() => {
              window.sessionStorage.setItem(dismissedKey(reminder.code), "1");
              setReminder(null);
            }}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-[#FAF8F6] cursor-pointer"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fasea-pending-toast-in {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fasea-pending-toast > div {
          animation: fasea-pending-toast-in 260ms ease-out both;
        }
      `}</style>
    </aside>
  );
}
