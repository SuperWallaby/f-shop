"use client";

import { useEffect, useMemo, useRef } from "react";
import { DateTime } from "luxon";
import EllipsisHorizontalIcon from "@heroicons/react/20/solid/EllipsisHorizontalIcon";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { CalendarDayDto } from "../_lib/types";
import type { RescheduleBookingTarget } from "./AdminRescheduleBookingModal";

type SlotBooking = CalendarDayDto["slots"][number]["bookings"][number];

const fieldClass =
  "w-full rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]";

function statusBadge(status: SlotBooking["status"]) {
  if (status === "confirmed") {
    return (
      <span className="inline-flex rounded-full bg-[#DFD1C9] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#444444]">
        Booked
      </span>
    );
  }
  if (status === "no_show") {
    return (
      <span className="inline-flex rounded-full border border-[#F1B3B0] bg-[#FCE8E6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#B42318]">
        No-show
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-[#F3ECE6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#716D64]">
      Cancelled
    </span>
  );
}

export function AdminTimeSelect(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-[#716D64]">{props.label}</span>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className={fieldClass}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AdminSlotBookingCard(props: {
  booking: SlotBooking;
  itemColor?: string;
  saving: boolean;
  copiedCodeBookingId: string | null;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onCopyCode: (bookingId: string, code: string) => void;
  onReschedule: () => void;
  onCancelBooking: () => void;
  onMarkNoShow: () => void;
  onDeleteCancelled: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const b = props.booking;

  useEffect(() => {
    if (!props.menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        props.onCloseMenu();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [props.menuOpen, props.onCloseMenu]);

  const bookedRel = useMemo(() => {
    if (typeof b.createdAt !== "string") return null;
    const now = DateTime.now().setZone(BUSINESS_TIME_ZONE);
    const when = DateTime.fromISO(b.createdAt).setZone(BUSINESS_TIME_ZONE);
    return when.isValid ? when.toRelative({ base: now }) : null;
  }, [b.createdAt]);

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3",
        b.status === "cancelled" && "opacity-80",
      )}
    >
      {props.itemColor ? (
        <div
          className="absolute left-0 top-3 bottom-3 w-1 rounded-full"
          style={{ backgroundColor: props.itemColor }}
          aria-hidden
        />
      ) : null}

      <div className="flex items-start gap-2 pl-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge(b.status)}
            {b.starred ? (
              <span className="text-[10px] text-[#716D64]" title="Starred">
                ★
              </span>
            ) : null}
            {bookedRel ? (
              <span className="text-[10px] text-[#716D64]">
                booked {bookedRel}
              </span>
            ) : null}
          </div>

          <div className="mt-1.5 flex items-baseline gap-2 flex-wrap min-w-0">
            {!!b.code && (
              <button
                type="button"
                onClick={() => props.onCopyCode(b.id, b.code)}
                className="text-xs font-mono text-[#716D64] hover:text-[#444444] hover:underline underline-offset-2"
                title="Copy booking code"
              >
                #{b.code}
              </button>
            )}
            {props.copiedCodeBookingId === b.id ? (
              <span className="text-[10px] text-[#716D64]">copied</span>
            ) : null}
            <div className="text-sm font-semibold text-[#444444] truncate">
              {b.name}
            </div>
          </div>

          {b.email ? (
            <div className="text-xs text-[#716D64] truncate">{b.email}</div>
          ) : null}
          {b.whatsapp ? (
            <div className="text-xs text-[#716D64] truncate">{b.whatsapp}</div>
          ) : null}

          {!!b.adminNote?.trim() && (
            <div className="mt-1.5 text-[11px] text-[#716D64] line-clamp-2">
              {b.adminNote.trim()}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {b.status === "confirmed" ? (
            <button
              type="button"
              disabled={props.saving}
              onClick={props.onMarkNoShow}
              className="rounded-full border border-[#F1B3B0] bg-[#FCE8E6] px-2.5 py-1 text-[11px] font-medium text-[#B42318] transition hover:brightness-95 disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F1B3B0]"
            >
              No-show
            </button>
          ) : null}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              disabled={props.saving}
              onClick={props.onToggleMenu}
              className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-[#E8DDD4] bg-[#FAF8F6] text-[#716D64] transition hover:bg-white hover:text-[#444444] disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DFD1C9] focus-visible:ring-offset-1"
              aria-label="Booking actions"
              aria-expanded={props.menuOpen}
            >
              <EllipsisHorizontalIcon className="h-5 w-5" aria-hidden />
            </button>

            {props.menuOpen ? (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[11.5rem] overflow-hidden rounded-2xl border border-[#E8DDD4] bg-white py-1 shadow-[0_8px_24px_rgba(78,56,48,0.12)]">
                {b.status === "confirmed" ? (
                  <>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm text-[#444444] hover:bg-[#FAF8F6] outline-none focus:outline-none focus-visible:bg-[#FAF8F6]"
                      onClick={() => {
                        props.onCloseMenu();
                        props.onReschedule();
                      }}
                    >
                      Reschedule
                    </button>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm text-[#444444] hover:bg-[#FAF8F6] outline-none focus:outline-none focus-visible:bg-[#FAF8F6]"
                      onClick={() => {
                        props.onCloseMenu();
                        props.onCancelBooking();
                      }}
                    >
                      Cancel booking
                    </button>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm text-[#444444] hover:bg-[#FAF8F6] outline-none focus:outline-none focus-visible:bg-[#FAF8F6]"
                      onClick={() => {
                        props.onCloseMenu();
                        props.onMarkNoShow();
                      }}
                    >
                      Mark no-show
                    </button>
                  </>
                ) : b.status === "cancelled" ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-[#B42318] hover:bg-[#FCE8E6] outline-none focus:outline-none focus-visible:bg-[#FCE8E6]"
                    onClick={() => {
                      props.onCloseMenu();
                      props.onDeleteCancelled();
                    }}
                  >
                    Delete booking
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function toRescheduleTarget(args: {
  booking: SlotBooking;
  slot: CalendarDayDto["slots"][number];
  dateKey: string;
}): RescheduleBookingTarget {
  return {
    id: args.booking.id,
    name: args.booking.name,
    email: args.booking.email ?? "",
    itemId: args.slot.itemId,
    itemName: args.slot.itemName,
    dateKey: args.dateKey,
    startMin: args.slot.startMin,
    endMin: args.slot.endMin,
    slotId: args.slot.id,
  };
}
