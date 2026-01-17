"use client";

import { cn } from "@/lib/cn";

export function Pill(props: {
  label: string;
  tone?: "neutral" | "good" | "warn" | "muted";
}) {
  const tone = props.tone ?? "neutral";
  const cls =
    tone === "good"
      ? "bg-[#716D64] text-[#FAF8F6]"
      : tone === "warn"
        ? "bg-[#A66A4A] text-[#FAF8F6]"
        : tone === "muted"
          ? "bg-[#F3ECE6] text-[#716D64] border border-[#D1B9B4]"
          : "bg-white/80 text-[#444444] border border-[#E8DDD4]";
  return (
    <span className={cn("text-[11px] px-2 py-1 rounded-full whitespace-nowrap", cls)}>
      {props.label}
    </span>
  );
}

