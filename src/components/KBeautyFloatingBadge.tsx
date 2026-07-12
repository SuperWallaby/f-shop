"use client";

import GiftIcon from "@heroicons/react/24/outline/GiftIcon";
import { usePathname } from "next/navigation";

const KBEAUTY_URL = "https://fasea-kbeauty.vercel.app";

export default function KBeautyFloatingBadge() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <div className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-[60] md:bottom-6 md:right-6">
      <a
        href={KBEAUTY_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open K-Beauty shop"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full border border-[#E8DDD4] bg-white/95 text-[#A66A4A] shadow-[0_8px_28px_rgba(78,56,48,0.16)] backdrop-blur-md transition hover:scale-[1.04] hover:border-[#D4C4BA] hover:shadow-[0_10px_32px_rgba(78,56,48,0.2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A66A4A]"
      >
        <GiftIcon className="h-6 w-6 transition group-hover:scale-105" aria-hidden />
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#E8DDD4] bg-[#FAF8F6] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#444444] shadow-sm">
          K-Beauty
        </span>
      </a>
    </div>
  );
}
