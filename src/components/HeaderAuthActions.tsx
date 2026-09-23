"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  CLIENT_AUTH_CHANGED_EVENT,
} from "@/lib/clientAuthEvents";

type ClientMe = {
  authed: boolean;
  client?: {
    id: string;
    name: string;
    email: string;
    whatsapp: string;
  };
};

function initialsFromClient(client: {
  name?: string;
  email?: string;
}): string {
  const name = (client.name ?? "").trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const email = (client.email ?? "").trim();
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

/** Deterministic soft brand-adjacent color from a string id/email. */
function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hues = [18, 28, 38, 350, 8, 22]; // warm terracotta / blush family
  const h = hues[hash % hues.length]!;
  const s = 42 + (hash % 18);
  const l = 48 + (hash % 12);
  return `hsl(${h} ${s}% ${l}%)`;
}

/** Same footprint for loading + Sign in to avoid header layout shift. */
const SIGN_IN_SHELL =
  "inline-flex h-9 min-w-[4.75rem] items-center justify-center rounded-full px-4 text-sm font-medium";

export function HeaderAuthActions() {
  const [me, setMe] = useState<ClientMe | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/public/client/me", {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok && json?.ok) {
        setMe(json.data as ClientMe);
      } else {
        setMe({ authed: false });
      }
    } catch {
      setMe({ authed: false });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadOnce() {
      try {
        const res = await fetch("/api/public/client/me", {
          credentials: "include",
          cache: "no-store",
        });
        const json = await res.json();
        if (cancelled) return;
        if (res.ok && json?.ok) {
          setMe(json.data as ClientMe);
        } else {
          setMe({ authed: false });
        }
      } catch {
        if (!cancelled) setMe({ authed: false });
      }
    }
    void loadOnce();
    const onAuthChanged = () => {
      void load();
    };
    window.addEventListener(CLIENT_AUTH_CHANGED_EVENT, onAuthChanged);
    window.addEventListener("focus", onAuthChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(CLIENT_AUTH_CHANGED_EVENT, onAuthChanged);
      window.removeEventListener("focus", onAuthChanged);
    };
  }, [load]);

  const initials = useMemo(() => {
    if (!me?.authed || !me.client) return "";
    return initialsFromClient(me.client);
  }, [me]);

  const bg = useMemo(() => {
    if (!me?.authed || !me.client) return "#A66A4A";
    return avatarColor(me.client.id || me.client.email || me.client.name);
  }, [me]);

  if (me === null) {
    return (
      <span
        className={cn(
          SIGN_IN_SHELL,
          "border border-[#E8DDD4] bg-white/60 text-transparent select-none",
        )}
        aria-hidden
      >
        Sign in
      </span>
    );
  }

  if (!me.authed || !me.client) {
    return (
      <Link
        href="/booking/account"
        className={cn(
          SIGN_IN_SHELL,
          "border border-[#E8DDD4] bg-white/90 text-[#444444]",
          "shadow-sm hover:brightness-95 transition cursor-pointer",
        )}
      >
        Sign in
      </Link>
    );
  }

  return (
    <Link
      href="/booking/account"
      aria-label="My account"
      title={me.client.name || me.client.email || "My account"}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
        "text-sm font-semibold text-white shadow-sm",
        "ring-1 ring-black/5 hover:brightness-95 transition cursor-pointer",
      )}
      style={{ backgroundColor: bg }}
    >
      <span aria-hidden>{initials}</span>
    </Link>
  );
}

export { initialsFromClient, avatarColor };
