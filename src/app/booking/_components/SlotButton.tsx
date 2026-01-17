"use client";

import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function SlotButton(props: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  title: ReactNode;
  subtitle: ReactNode;
  color?: string;
}) {
  return (
    <button
      disabled={props.disabled}
      onClick={props.onClick}
      style={
        !props.disabled && props.color
          ? { backgroundColor: props.color }
          : undefined
      }
      className={cn(
        "text-left rounded-2xl border px-4 py-3 transition cursor-pointer relative",
        props.disabled
          ? "bg-[#FAF8F6] border-[#E8DDD4] opacity-60 cursor-not-allowed"
          : "bg-white border-[#E8DDD4] hover:shadow-sm",
        props.selected
          ? "ring-2 ring-[#A66A4A] ring-offset-2 ring-offset-[#FAF8F6] shadow-sm"
          : ""
      )}
    >
      {props.selected ? (
        <span className="absolute top-3 right-3 h-6 w-6 rounded-full border border-[#A66A4A] bg-white/80 text-[#A66A4A] flex items-center justify-center text-sm leading-none">
          ✓
        </span>
      ) : null}
      <div className="text-sm font-semibold text-[#444444]">{props.title}</div>
      <div className="text-sm text-[#716D64] mt-1">{props.subtitle}</div>
    </button>
  );
}

