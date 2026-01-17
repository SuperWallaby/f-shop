"use client";

import { cn } from "@/lib/cn";

export function Switch(props: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { checked, onCheckedChange, label, disabled, className } = props;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-14 items-center rounded-full transition cursor-pointer select-none",
          // Track: make OFF clearly muted, ON clearly strong.
          "border shadow-[inset_0_0_0_1px_rgba(0,0,0,0.02)]",
          checked
            ? "bg-[#A66A4A] border-[#8E5638]"
            : "bg-[#B7ADA6] border-[#9F948D]",
          "focus:outline-none focus:ring-2 focus:ring-[#DFD1C9] focus:ring-offset-2 focus:ring-offset-[#FAF8F6]",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Track indicators */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-2 text-[10px] font-semibold text-white transition-opacity",
            checked ? "opacity-100" : "opacity-0"
          )}
        >
          ✓
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "absolute right-2 text-[10px] font-semibold transition-opacity",
            checked ? "opacity-0" : "opacity-90 text-[#4B4742]"
          )}
        >
          OFF
        </span>
        <span
          className={cn(
            // Thumb: keep it white, but increase contrast.
            "inline-block h-5 w-5 transform rounded-full border shadow-sm transition",
            checked ? "bg-white border-[#7E4C34]" : "bg-[#F3F0EE] border-[#9F948D]",
            checked ? "translate-x-8" : "translate-x-1"
          )}
        />
      </button>
      {!!label && <span className="text-sm text-[#444444]">{label}</span>}
    </div>
  );
}

