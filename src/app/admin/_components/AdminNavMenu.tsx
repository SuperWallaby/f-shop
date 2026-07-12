"use client";

import { useEffect, useId, useRef, useState } from "react";
import Bars3Icon from "@heroicons/react/24/outline/Bars3Icon";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";
import { cn } from "@/lib/cn";

export type AdminNavItem = {
  key: string;
  label: string;
  group?: string;
};

const GROUPS: Array<{ id: string; label: string }> = [
  { id: "ops", label: "Operations" },
  { id: "setup", label: "Setup" },
  { id: "money", label: "Clients & sales" },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { key: "calendar", label: "Calendar", group: "ops" },
  { key: "bookings", label: "Bookings", group: "ops" },
  { key: "time", label: "Time manage", group: "ops" },
  { key: "config", label: "Pattern", group: "setup" },
  { key: "items", label: "Class Types", group: "setup" },
  { key: "plans", label: "Plans", group: "setup" },
  { key: "settings", label: "Settings", group: "setup" },
  { key: "clients", label: "Clients & credits", group: "money" },
  { key: "sales", label: "Sales", group: "money" },
  { key: "promotions", label: "Promotions", group: "money" },
  { key: "expiry", label: "Expiry", group: "money" },
];

export function adminNavLabel(key: string): string {
  return ADMIN_NAV_ITEMS.find((t) => t.key === key)?.label ?? key;
}

function AdminNavLinks(props: {
  activeKey: string;
  onSelect: (key: string) => void;
  id?: string;
}) {
  return (
    <nav id={props.id} className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      {GROUPS.map((group) => {
        const items = ADMIN_NAV_ITEMS.filter((t) => t.group === group.id);
        if (items.length === 0) return null;
        return (
          <div key={group.id}>
            <div className="px-3 mb-2 text-[11px] uppercase tracking-wide text-[#716D64]">
              {group.label}
            </div>
            <ul className="space-y-1">
              {items.map((item) => {
                const active = props.activeKey === item.key;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => props.onSelect(item.key)}
                      className={cn(
                        "w-full text-left rounded-2xl px-3 py-2.5 text-sm transition cursor-pointer",
                        active
                          ? "bg-[#DFD1C9] font-medium text-[#444444]"
                          : "text-[#444444] hover:bg-white/80",
                      )}
                    >
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/** Tablet+ : always-visible side rail (hidden only below md) */
export function AdminSidebar(props: {
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <aside
      aria-label="Admin navigation"
      className="max-md:hidden flex w-56 lg:w-60 shrink-0 sticky top-24 self-start h-[calc(100vh-7rem)] flex-col rounded-3xl border border-[#E8DDD4] bg-white/90 shadow-sm overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-[#E8DDD4] shrink-0">
        <div className="font-serif text-lg font-semibold">Admin</div>
        <div className="text-xs text-[#716D64] mt-0.5 truncate">
          {adminNavLabel(props.activeKey)}
        </div>
      </div>
      <AdminNavLinks activeKey={props.activeKey} onSelect={props.onSelect} />
    </aside>
  );
}

/** Mobile only: hamburger + full-screen overlay drawer */
export function AdminNavMenu(props: {
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
        className="max-md:inline-flex hidden h-10 w-10 items-center justify-center rounded-full border border-[#E8DDD4] bg-white/80 hover:shadow-sm transition cursor-pointer"
      >
        <Bars3Icon className="h-5 w-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-[#444444]/45"
            onClick={() => setOpen(false)}
          />
          <aside
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="absolute inset-y-0 left-0 flex w-[min(100%,18.5rem)] flex-col bg-[#FAF8F6] shadow-xl border-r border-[#E8DDD4]"
          >
            <div className="flex items-center justify-between gap-3 px-5 py-5 border-b border-[#E8DDD4]">
              <div>
                <div className="font-serif text-xl font-semibold">Menu</div>
                <div className="text-xs text-[#716D64] mt-0.5">
                  {adminNavLabel(props.activeKey)}
                </div>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E8DDD4] bg-white/80 hover:shadow-sm transition cursor-pointer"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <AdminNavLinks
              activeKey={props.activeKey}
              onSelect={(key) => {
                props.onSelect(key);
                setOpen(false);
              }}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}
