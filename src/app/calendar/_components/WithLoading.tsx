"use client";

import type { ReactNode } from "react";

export function WithLoading(props: {
  loading: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  if (props.loading) return <>{props.fallback ?? null}</>;
  return <>{props.children}</>;
}

