"use client";

import type { DateTime } from "luxon";
import { cn } from "@/lib/cn";

export function DayChip(props: {
  dateKey: string;
  dt: DateTime;
  selected: boolean;
  hasSlots: boolean;
  onClick: () => void;
}) {
  return (
    <button
      id={`mobile-day-${props.dateKey}`}
      type="button"
      onClick={props.onClick}
      className={cn(
        "shrink-0 w-[89px] rounded-2xl border px-3 py-3 text-left transition",
        props.selected
          ? "bg-[#DFD1C9] border-[#DFD1C9]"
          : "bg-white/80 border-[#E8DDD4] hover:shadow-sm"
      )}
    >
      <div className="text-[10px] text-[#716D64]">{props.dt.toFormat("ccc")}</div>
      <div className="text-lg font-semibold leading-none mt-1">{props.dt.day}</div>
      <div className="mt-2 text-[10px] text-[#716D64]">
        {props.hasSlots ? "Has slots" : "—"}
      </div>
    </button>
  );
}

