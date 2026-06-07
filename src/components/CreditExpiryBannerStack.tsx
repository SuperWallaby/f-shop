"use client";

import { DateTime } from "luxon";

export type ExpiryAlertBannerDto = {
  expiresAt: string;
  windowStart: string;
  windowEnd: string;
  credits: number;
  expiryApproved: boolean;
  showBanner: boolean;
};

/** Member-facing reminders during the ±7 day window around each expiry date. */
export function CreditExpiryBannerStack({ alerts }: { alerts: ExpiryAlertBannerDto[] }) {
  const visible = alerts.filter((a) => a.showBanner && a.credits > 0);
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((a) => {
        const exp = DateTime.fromISO(a.expiresAt);
        const ws = DateTime.fromISO(a.windowStart);
        const we = DateTime.fromISO(a.windowEnd);
        return (
          <div
            key={`${a.expiresAt}-${a.credits}`}
            className="rounded-2xl border border-[#F2D3A2] bg-[#FFFDF8] px-4 py-3 text-sm text-[#444444]"
          >
            <div className="font-medium">
              {a.credits} credit{a.credits === 1 ? "" : "s"} · expiry {exp.toFormat("LLL d, yyyy")}
            </div>
            <div className="mt-1 text-xs text-[#716D64]">
              Reminder window: {ws.toFormat("LLL d")} – {we.toFormat("LLL d, yyyy")} (one week before and
              after expiry).
            </div>
            {a.expiryApproved ? (
              <div className="mt-2 text-xs text-[#1F6B3C]">
                Studio confirmed expiry — these credits stop counting after the expiry date.
              </div>
            ) : (
              <div className="mt-2 text-xs text-[#8A5A00]">
                Expiry not confirmed by studio yet — credits stay usable past the printed date until
                confirmation.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
