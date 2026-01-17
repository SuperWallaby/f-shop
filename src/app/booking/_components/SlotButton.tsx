"use client";

import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

function normalizeHexColor(hex: string): string | null {
  const raw = hex.trim();
  if (!raw) return null;
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  return null;
}

function tintHexColor(hex: string, mixWithWhite = 0.82): string | null {
  const n = normalizeHexColor(hex);
  if (!n) return null;
  const raw = n.slice(1);
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const t = Math.min(1, Math.max(0, mixWithWhite));
  const rr = Math.round(r + (255 - r) * t);
  const gg = Math.round(g + (255 - g) * t);
  const bb = Math.round(b + (255 - b) * t);
  return `rgb(${rr} ${gg} ${bb})`;
}

export function SlotButton(props: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  title: ReactNode;
  subtitle: ReactNode;
  color?: string;
}) {
  const tintedBg =
    props.selected && props.color ? tintHexColor(props.color, 0.82) : null;

  return (
    <button
      disabled={props.disabled}
      onClick={props.onClick}
      aria-pressed={props.selected}
      style={
        !props.disabled && tintedBg
          ? { backgroundColor: tintedBg }
          : undefined
      }
      className={cn(
        "text-left rounded-2xl border px-4 py-3 transition cursor-pointer relative",
        props.disabled
          ? "bg-[#FAF8F6] border-[#E8DDD4] opacity-60 cursor-not-allowed"
          : "bg-white/80 border-[#E8DDD4] hover:bg-white hover:shadow-sm",
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
      <div className="text-sm font-semibold text-[#444444] inline-flex items-center gap-2">
        {!!props.color && !props.disabled ? (
          <span
            className="inline-block h-2.5 w-2.5 rounded-full border border-black/10"
            style={{ backgroundColor: props.color }}
            aria-hidden
          />
        ) : null}
        {props.title}
      </div>
      <div className="text-sm text-[#716D64] mt-1">{props.subtitle}</div>
    </button>
  );
}

