"use client";

import type { ReactNode } from "react";

export function WithError(props: {
  error: string | null;
  fallback?: (message: string) => ReactNode;
  children: ReactNode;
}) {
  if (!props.error) return <>{props.children}</>;
  return <>{props.fallback ? props.fallback(props.error) : null}</>;
}

