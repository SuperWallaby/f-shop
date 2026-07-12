"use client";

import { DateTime } from "luxon";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { cn } from "@/lib/cn";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function weekCountForMonth(month: Date): number {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const startOffset = first.getDay();
  return Math.ceil((startOffset + lastDay) / 7);
}

type Props = {
  month: Date;
};

export function BookingCalendarSkeleton({ month }: Props) {
  const caption = DateTime.fromJSDate(month, { zone: BUSINESS_TIME_ZONE }).toFormat(
    "LLLL yyyy",
  );
  const weekCount = weekCountForMonth(month);

  return (
    <div
      className="rdp-root booking-day-picker booking-calendar-skeleton w-full"
      aria-busy="true"
      aria-label="Loading calendar"
    >
      <div className="rdp-months w-full">
        <nav className="rdp-nav" aria-hidden>
          <button
            type="button"
            tabIndex={-1}
            disabled
            className="rdp-button_previous pointer-events-none"
          >
            <span className="rdp-chevron booking-calendar-skeleton-chevron animate-pulse" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            disabled
            className="rdp-button_next pointer-events-none"
          >
            <span className="rdp-chevron booking-calendar-skeleton-chevron animate-pulse" />
          </button>
        </nav>

        <div className="rdp-month w-full">
          <div className="rdp-month_caption">
            <span className="rdp-caption_label">{caption}</span>
          </div>

          <table className="rdp-month_grid w-full">
            <thead>
              <tr className="rdp-weekdays">
                {WEEKDAY_LABELS.map((label) => (
                  <th key={label} scope="col" className="rdp-weekday">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="rdp-weeks">
              {Array.from({ length: weekCount }).map((_, weekIdx) => (
                <tr key={weekIdx} className="rdp-week">
                  {WEEKDAY_LABELS.map((label) => (
                    <td key={`${weekIdx}-${label}`} className="rdp-day">
                      <span
                        className={cn(
                          "rdp-day_button booking-calendar-skeleton-day animate-pulse",
                          "pointer-events-none border-2 border-transparent",
                        )}
                        aria-hidden
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
