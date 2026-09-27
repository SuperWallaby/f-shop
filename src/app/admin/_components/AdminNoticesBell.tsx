"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import BellIcon from "@heroicons/react/24/outline/BellIcon";
import ArrowPathIcon from "@heroicons/react/24/outline/ArrowPathIcon";
import ChevronRightIcon from "@heroicons/react/24/outline/ChevronRightIcon";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";
import { cn } from "@/lib/cn";

type NoticeTab = "calendar" | "bookings" | "expiry" | "sales" | "clients";

type AdminNotice = {
  id: string;
  title: string;
  body: string;
  tone: "attention" | "info";
  tab: NoticeTab;
  createdAt: string;
};

type PendingBooking = {
  id: string;
  code: string;
  name: string;
  whatsapp: string;
  className: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  createdAt: string;
  dmOpenedAt: string | null;
};

function formatMin(min: number): string {
  const hour = Math.floor(min / 60);
  const minute = min % 60;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${
    hour >= 12 ? "PM" : "AM"
  }`;
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString("en-MY", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AdminNoticesBell(props: {
  onOpenTab: (tab: NoticeTab) => void;
  onOpenBooking: (bookingCode: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<AdminNotice[]>([]);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/notices", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Could not load notices");
      }
      setNotices((json.data?.notices ?? []) as AdminNotice[]);
      setPendingBookings(
        (json.data?.pendingBookings ?? []) as PendingBooking[],
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load notices");
      setNotices([]);
      setPendingBookings([]);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const refreshTimer = window.setInterval(() => void load(true), 15_000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [load, open]);

  const count = notices.length + pendingBookings.length;
  const feed = useMemo(
    () =>
      [
        ...pendingBookings.map((booking) => ({
          kind: "booking" as const,
          id: `booking-${booking.id}`,
          createdAt: booking.createdAt,
          booking,
        })),
        ...notices.map((notice) => ({
          kind: "notice" as const,
          id: `notice-${notice.id}`,
          createdAt: notice.createdAt,
          notice,
        })),
      ].sort((a, b) => {
        const aTime = Date.parse(a.createdAt);
        const bTime = Date.parse(b.createdAt);
        return (Number.isFinite(bTime) ? bTime : 0) -
          (Number.isFinite(aTime) ? aTime : 0);
      }),
    [notices, pendingBookings],
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={count > 0 ? `${count} notices` : "Notices"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E8DDD4] bg-white/80 hover:shadow-sm transition cursor-pointer"
      >
        <BellIcon className="h-5 w-5" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-[#C62828] px-1 text-[10px] font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
            style={{ background: "rgba(68, 68, 68, 0.18)" }}
          />
          <aside
            id={panelId}
            role="dialog"
            aria-label="Notifications"
            aria-modal="true"
            className="fasea-notification-drawer fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[#E8DDD4] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4 border-b border-[#E8DDD4] px-5 py-5">
              <div>
                <div className="font-serif text-xl font-semibold">
                  Notifications
                </div>
                <div className="mt-0.5 text-xs text-[#716D64]">
                  {count} active notification{count === 1 ? "" : "s"}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void load()}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E8DDD4] hover:bg-[#FAF8F6] cursor-pointer"
                  aria-label="Refresh notifications"
                >
                  <ArrowPathIcon
                    className={cn("h-4 w-4", loading && "animate-spin")}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#FAF8F6] cursor-pointer"
                  aria-label="Close notifications"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
              {loading ? (
                <p className="px-3 py-8 text-sm text-[#716D64]">Loading…</p>
              ) : error ? (
                <p className="px-3 py-8 text-sm text-[#C62828]">{error}</p>
              ) : pendingBookings.length === 0 && notices.length === 0 ? (
                <p className="px-3 py-8 text-sm text-[#716D64]">
                  Nothing needs attention right now.
                </p>
              ) : (
                <ul className="space-y-1">
                  {feed.map((entry) =>
                    entry.kind === "booking" ? (
                      <li key={entry.id}>
                        <button
                          type="button"
                          onClick={() => {
                            props.onOpenBooking(entry.booking.code);
                            setOpen(false);
                          }}
                          className="group w-full rounded-2xl px-3 py-3 text-left transition hover:bg-[#FAF8F6] cursor-pointer"
                        >
                          <span className="flex items-start gap-3">
                            <span
                              aria-hidden
                              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{
                                background: entry.booking.dmOpenedAt
                                  ? "#2F6B4F"
                                  : "#C62828",
                              }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-[#444444]">
                                  {entry.booking.name}
                                </span>
                                <span
                                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                  style={{
                                    background: entry.booking.dmOpenedAt
                                      ? "#EDF7F0"
                                      : "#FFF0EE",
                                    color: entry.booking.dmOpenedAt
                                      ? "#2F6B4F"
                                      : "#C62828",
                                  }}
                                >
                                  {entry.booking.dmOpenedAt
                                    ? "DM opened"
                                    : "DM not clicked"}
                                </span>
                              </span>
                              <span className="mt-1 block text-sm text-[#5C574F]">
                                {entry.booking.className} ·{" "}
                                {entry.booking.dateKey} ·{" "}
                                {formatMin(entry.booking.startMin)}–
                                {formatMin(entry.booking.endMin)}
                              </span>
                              <span className="mt-1.5 flex items-center gap-3 text-[11px] text-[#716D64]">
                                <span className="font-mono">
                                  #{entry.booking.code}
                                </span>
                                <span>
                                  {formatCreatedAt(entry.booking.createdAt)}
                                </span>
                              </span>
                            </span>
                            <ChevronRightIcon className="mt-1 h-4 w-4 shrink-0 text-[#A99B91] transition group-hover:translate-x-0.5" />
                          </span>
                        </button>
                      </li>
                    ) : (
                      <li key={entry.id}>
                        <button
                          type="button"
                          onClick={() => {
                            props.onOpenTab(entry.notice.tab);
                            setOpen(false);
                          }}
                          className="group w-full rounded-2xl px-3 py-3 text-left hover:bg-[#FAF8F6] transition cursor-pointer"
                        >
                          <span className="flex items-start gap-3">
                            <span
                              aria-hidden
                              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                              style={{
                                background:
                                  entry.notice.tone === "attention"
                                    ? "#C62828"
                                    : "#A66A4A",
                              }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-[#444444]">
                                {entry.notice.title}
                              </span>
                              <span className="mt-0.5 block text-xs leading-relaxed text-[#716D64]">
                                {entry.notice.body}
                              </span>
                              <span className="mt-1.5 block text-[11px] text-[#716D64]">
                                {formatCreatedAt(entry.notice.createdAt)}
                              </span>
                            </span>
                            <ChevronRightIcon className="mt-1 h-4 w-4 shrink-0 text-[#A99B91] transition group-hover:translate-x-0.5" />
                          </span>
                        </button>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </div>
            <style>{`
              @keyframes fasea-notification-drawer-in {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
              }
              .fasea-notification-drawer {
                animation: fasea-notification-drawer-in 240ms ease-out both;
              }
            `}</style>
          </aside>
        </>
      ) : null}
    </div>
  );
}
