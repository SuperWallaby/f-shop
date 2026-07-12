"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

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

export function HeaderAuthActions() {
  const [me, setMe] = useState<ClientMe | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/public/client/me", {
          credentials: "include",
          cache: "no-store",
        });
        const json = await res.json();
        if (!cancelled && res.ok && json?.ok) {
          setMe(json.data as ClientMe);
        } else if (!cancelled) {
          setMe({ authed: false });
        }
      } catch {
        if (!cancelled) setMe({ authed: false });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const initials = useMemo(() => {
    if (!me?.authed || !me.client) return "";
    return initialsFromClient(me.client);
  }, [me]);

  const bg = useMemo(() => {
    if (!me?.authed || !me.client) return "#A66A4A";
    return avatarColor(me.client.id || me.client.email || me.client.name);
  }, [me]);

  if (me === null || !me.authed || !me.client) {
    return null;
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
