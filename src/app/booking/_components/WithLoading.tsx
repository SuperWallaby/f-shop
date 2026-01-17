"use client";

import type { ReactNode } from "react";

export function WithLoading(props: {
  loading: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  if (props.loading) {
    return props.fallback ?? <div className="text-sm text-[#716D64]">Loading…</div>;
  }
  return <>{props.children}</>;
}

