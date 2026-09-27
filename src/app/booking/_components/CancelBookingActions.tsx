"use client";

import { useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import ClockIcon from "@heroicons/react/24/outline/ClockIcon";
import ExclamationTriangleIcon from "@heroicons/react/24/outline/ExclamationTriangleIcon";
import {
  canSelfCancel,
  lateCancelFeeRm,
  lateCancelWhatsAppUrl,
  CANCEL_NOTICE_HOURS,
} from "@/lib/cancelPolicy";

type Props = {
  code: string;
  className: string;
  whenLabel: string;
  startUtc: string;
  cancelling: boolean;
  onCancel: () => Promise<void>;
};

export function CancelBookingActions({
  code,
  className,
  whenLabel,
  startUtc,
  cancelling,
  onCancel,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const allowed = canSelfCancel(startUtc);
  const fee = lateCancelFeeRm(className || "");

  if (!allowed) {
    const href = lateCancelWhatsAppUrl({
      code,
      className: className || "Class",
      when: whenLabel,
    });
    return (
      <div
        className="mt-4 rounded-2xl px-4 py-4"
        style={{
          border: "1px solid #E8DDD4",
          background: "#FFF8F6",
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: "#FFF0EE", color: "#C62828" }}
          >
            <ExclamationTriangleIcon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold" style={{ color: "#444444" }}>
              Online cancellation is closed
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#716D64]">
              This class starts within {CANCEL_NOTICE_HOURS} hours. Contact the
              studio on WhatsApp to cancel.
            </p>
            <div
              className="mt-3 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{ background: "#FFF0EE", color: "#C62828" }}
            >
              Late cancellation fee · RM {fee}
            </div>
            <p className="mt-2 text-[11px] text-[#716D64]">
              Group RM 10 · Private RM 20
            </p>
          </div>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold hover:brightness-95"
          style={{ background: "#25D366", color: "#111111" }}
        >
          <FaWhatsapp className="h-4 w-4" aria-hidden />
          Message on WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div
        className="rounded-2xl px-4 py-3.5"
        style={{ border: "1px solid #E8DDD4", background: "#FAF8F6" }}
      >
        <div className="flex items-start gap-3">
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: "#F3ECE6", color: "#716D64" }}
          >
            <ClockIcon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#716D64]">
              Cancellation policy
            </div>
            <div className="mt-1 text-sm font-semibold text-[#444444]">
              Free cancellation until {CANCEL_NOTICE_HOURS} hours before class
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#716D64]">
              After the cutoff, contact us on WhatsApp. Group RM 10 · Private
              RM 20.
            </p>
          </div>
        </div>
      </div>
      {confirming ? (
        <div
          className="mt-3 rounded-2xl px-4 py-4"
          style={{ border: "1px solid #F1B3B0", background: "#FFF8F6" }}
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-[#C62828]">
            Final confirmation
          </div>
          <div className="mt-1 text-base font-semibold text-[#444444]">
            Cancel this booking?
          </div>
          <div className="mt-2 text-sm font-medium text-[#5C574F]">
            {className || "Class"}
          </div>
          <div className="mt-0.5 text-xs text-[#716D64]">{whenLabel}</div>
          <p className="mt-3 text-xs text-[#716D64]">
            This action cannot be undone.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={cancelling}
              onClick={() => void onCancel()}
              className="rounded-full px-4 py-2.5 text-sm font-semibold hover:brightness-95 disabled:opacity-50 cursor-pointer"
              style={{ background: "#C62828", color: "#ffffff" }}
            >
              {cancelling ? "Cancelling…" : "Confirm cancel"}
            </button>
            <button
              type="button"
              disabled={cancelling}
              onClick={() => setConfirming(false)}
              className="rounded-full border border-[#E8DDD4] bg-white px-4 py-2.5 text-sm font-medium cursor-pointer"
            >
              Keep booking
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={cancelling}
          onClick={() => setConfirming(true)}
          className="mt-3 rounded-full border border-[#E8DDD4] bg-[#F3ECE6] px-4 py-2 text-sm hover:brightness-95 disabled:opacity-50 cursor-pointer"
        >
          {cancelling ? "Cancelling…" : "Cancel booking"}
        </button>
      )}
    </div>
  );
}
