"use client";

import { cn } from "@/lib/cn";

export function Checkbox(props: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { checked, onCheckedChange, label, disabled, className } = props;

  return (
    <label className={cn("flex items-start gap-3 select-none", className)}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md border transition cursor-pointer",
          checked
            ? "bg-[#A66A4A] border-[#8E5638]"
            : "bg-white border-[#E8DDD4]",
          "focus:outline-none focus:ring-2 focus:ring-[#DFD1C9] focus:ring-offset-2 focus:ring-offset-[#FAF8F6]",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "text-[12px] font-bold leading-none transition-opacity",
            checked ? "opacity-100 text-white" : "opacity-0"
          )}
        >
          ✓
        </span>
      </button>
      {!!label ? (
        <span className={cn("text-sm text-[#444444]", disabled && "opacity-70")}>
          {label}
        </span>
      ) : null}
    </label>
  );
}

