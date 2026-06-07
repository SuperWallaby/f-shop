"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { XMarkIcon } from "@heroicons/react/24/outline";
import {
  SALES_POPUP_FORCE_OPEN_EVENT,
  SALES_POPUP_IMAGE,
  SALES_POPUP_IMAGE_HEIGHT,
  SALES_POPUP_IMAGE_WIDTH,
  SALES_POPUP_LINK,
  SALES_POPUP_SNOOZE_MS,
  SALES_POPUP_STORAGE_KEY,
} from "@/lib/salesPopup";

function shouldSkipPopupHost() {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return host === "shop.fasea.studio" || host.startsWith("shop.");
}

function canShowPopup(now: number) {
  try {
    const lastShown = localStorage.getItem(SALES_POPUP_STORAGE_KEY);
    if (!lastShown) return true;
    return now - Number.parseInt(lastShown, 10) > SALES_POPUP_SNOOZE_MS;
  } catch {
    return true;
  }
}

export default function SalesPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const openPopup = useCallback(() => {
    if (shouldSkipPopupHost()) return;
    setIsOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsVisible(true));
    });
  }, []);

  const handleClose = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setIsVisible(false);
    window.setTimeout(() => {
      setIsOpen(false);
      try {
        localStorage.setItem(
          SALES_POPUP_STORAGE_KEY,
          String(Date.now()),
        );
      } catch {
        /* ignore */
      }
    }, 300);
  }, []);

  useEffect(() => {
    if (shouldSkipPopupHost()) return;

    if (canShowPopup(Date.now())) {
      const timer = window.setTimeout(openPopup, 1200);
      return () => window.clearTimeout(timer);
    }

    const onForceOpen = () => openPopup();
    window.addEventListener(SALES_POPUP_FORCE_OPEN_EVENT, onForceOpen);
    return () =>
      window.removeEventListener(SALES_POPUP_FORCE_OPEN_EVENT, onForceOpen);
  }, [openPopup]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Fasea shop promotion"
    >
      <div
        className={`absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        className={`relative z-10 flex w-full max-w-md max-h-[90vh] items-center justify-center transition-all duration-300 ${
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute -top-11 right-0 z-20 rounded-full p-1 text-white/90 transition hover:bg-white/10 hover:text-white"
          aria-label="Close popup"
        >
          <XMarkIcon className="h-8 w-8 sm:h-9 sm:w-9" />
        </button>
        <a
          href={SALES_POPUP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            try {
              localStorage.setItem(
                SALES_POPUP_STORAGE_KEY,
                String(Date.now()),
              );
            } catch {
              /* ignore */
            }
          }}
          className="relative block w-full overflow-hidden rounded-fasea-lg shadow-2xl ring-1 ring-white/10"
          aria-label="Open Fasea shop — Hot K-beauty limited items"
        >
          <Image
            src={SALES_POPUP_IMAGE}
            alt="Hot K-beauty limited items in Fasea Studio"
            width={SALES_POPUP_IMAGE_WIDTH}
            height={SALES_POPUP_IMAGE_HEIGHT}
            priority
            className="h-auto max-h-[85vh] w-full object-contain"
            sizes="(max-width: 640px) 100vw, 28rem"
          />
        </a>
      </div>
    </div>
  );
}
