"use client";

import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function TabButton(props: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={props.onClick}
      className={cn(
        "px-4 py-2 rounded-full text-sm border transition cursor-pointer",
        props.active
          ? "bg-[#DFD1C9] border-[#DFD1C9]"
          : "bg-white/80 border-[#E8DDD4] hover:shadow-sm"
      )}
    >
      {props.children}
    </button>
  );
}

