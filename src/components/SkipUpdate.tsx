"use client";

import { memo } from "react";
import type { ReactNode } from "react";

/**
 * SkipUpdate
 * - When `block` is true, re-renders are skipped (keeps last rendered UI).
 * - When `block` becomes false, the component re-renders normally.
 *
 * Useful to avoid skeleton/flicker during refresh loads after initial content is shown.
 */
export const SkipUpdate = memo(
  function SkipUpdate(props: { block: boolean; children: ReactNode }) {
    return <>{props.children}</>;
  },
  (_prev, next) => {
    return next.block;
  }
);

