"use client";

import { useCallback, useEffect, useState } from "react";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";

const SNOOZE_MS = 1000 * 60 * 60 * 24; // 24h

type ModalPromo = {
  id: string;
  name: string;
  imageUrl: string;
  modalLink: string;
};

function shouldSkipPopupHost() {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  if (host === "shop.fasea.studio" || host.startsWith("shop.")) return true;
  const path = window.location.pathname;
  if (path.startsWith("/admin")) return true;
  return false;
}

function storageKey(id: string) {
  return `fasea_promo_modal_${id}`;
}

function canShow(id: string, now: number) {
  try {
    const last = localStorage.getItem(storageKey(id));
    if (!last) return true;
    return now - Number.parseInt(last, 10) > SNOOZE_MS;
  } catch {
    return true;
  }
}

function markShown(id: string) {
  try {
    localStorage.setItem(storageKey(id), String(Date.now()));
  } catch {
    /* ignore */
  }
}

export default function PromotionModal() {
  const [promo, setPromo] = useState<ModalPromo | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const openPopup = useCallback((next: ModalPromo) => {
    if (shouldSkipPopupHost()) return;
    setPromo(next);
    setIsOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsVisible(true));
    });
  }, []);

  const handleClose = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      e?.preventDefault();
      setIsVisible(false);
      window.setTimeout(() => {
        if (promo) markShown(promo.id);
        setIsOpen(false);
        setPromo(null);
      }, 300);
    },
    [promo],
  );

  useEffect(() => {
    if (shouldSkipPopupHost()) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/public/promotions", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json?.ok || cancelled) return;
        const list = (json.data?.promotions ?? []) as Array<{
          id: string;
          name: string;
          imageUrl: string;
          showAsModal: boolean;
          modalLink: string;
        }>;
        const candidate = list.find(
          (p) => p.showAsModal && p.imageUrl && canShow(p.id, Date.now()),
        );
        if (candidate) {
          window.setTimeout(
            () =>
              openPopup({
                id: candidate.id,
                name: candidate.name,
                imageUrl: candidate.imageUrl,
                modalLink: candidate.modalLink ?? "",
              }),
            1200,
          );
        }
      } catch {
        /* ignore */
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [openPopup]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose, isOpen]);

  if (!isOpen || !promo) return null;

  const inner = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={promo.imageUrl}
      alt={promo.name}
      className="h-auto max-h-[85vh] w-full object-contain rounded-2xl bg-white shadow-2xl ring-1 ring-white/10"
    />
  );

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={promo.name}
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
          className="absolute -top-11 right-0 z-20 rounded-full p-1 text-white/90 transition hover:bg-white/10 hover:text-white cursor-pointer"
          aria-label="Close popup"
        >
          <XMarkIcon className="h-8 w-8 sm:h-9 sm:w-9" />
        </button>
        {promo.modalLink ? (
          <a
            href={promo.modalLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => markShown(promo.id)}
            className="relative block w-full overflow-hidden"
            aria-label={promo.name}
          >
            {inner}
          </a>
        ) : (
          <div className="relative block w-full overflow-hidden">{inner}</div>
        )}
      </div>
    </div>
  );
}
