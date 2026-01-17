"use client";

import type { ReactNode } from "react";

export function WithError(props: {
  error: string | null;
  fallback?: (message: string) => ReactNode;
  children: ReactNode;
}) {
  if (props.error) {
    return props.fallback ? (
      <>{props.fallback(props.error)}</>
    ) : (
      <div className="text-sm text-red-700">{props.error}</div>
    );
  }
  return <>{props.children}</>;
}

