"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { XMarkIcon } from "@heroicons/react/20/solid";

const SHOP_URL = "https://shop.fasea.studio";
const STORAGE_KEY = "fasea_shop_toast_snooze_until";
const SHOW_DELAY_MS = 11_000;
const SNOOZE_MS = 4 * 24 * 60 * 60 * 1000;

function ShopLogo() {
  return (
    <span
      className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center"
      aria-hidden
    >
      <Image
        src="/oy-logo.svg"
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 object-contain"
      />
    </span>
  );
}

function KBeautyBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-fasea-border bg-fasea-surface-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-fasea-tertiary shadow-sm">
      K-Beauty
    </span>
  );
}

export default function FaseaShopToast() {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    if (host === "shop.fasea.studio" || host.startsWith("shop.")) return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && Number(raw) > Date.now()) return;
    } catch {
      /* show anyway */
    }

    timerRef.current = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:justify-end md:p-6 fasea-shop-toast-enter"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto relative w-full max-w-[min(100%,20rem)]">
        <a
          href={SHOP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col gap-2 rounded-[1.35rem] border border-fasea-border bg-fasea-surface-muted/95 px-4 py-3.5 pr-10 shadow-[0_8px_30px_rgba(78,56,48,0.12)] backdrop-blur-md transition hover:border-fasea-border-strong hover:shadow-[0_10px_36px_rgba(78,56,48,0.16)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-serif text-lg font-semibold tracking-tight text-fasea-tertiary">
                fasea shop
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <KBeautyBadge />
                <span className="text-[11px] font-medium text-fasea-secondary">
                  Curated cosmetics
                </span>
              </div>
            </div>
            <ShopLogo />
          </div>
          <p className="border-t border-fasea-border/80 pt-2 text-[12px] leading-snug text-fasea-secondary">
            <span className="font-semibold text-fasea-primary">Hot K-beauty</span>{" "}
            limited items{" "}
            <span className="text-fasea-tertiary">in Fasea Studio</span>.
          </p>
          <div className="text-[11px] text-fasea-primary opacity-0 transition group-hover:opacity-100">
            Open shop.fasea.studio →
          </div>
        </a>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            dismiss();
          }}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-fasea-secondary transition hover:bg-fasea-canvas hover:text-fasea-tertiary"
          aria-label="Dismiss"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
