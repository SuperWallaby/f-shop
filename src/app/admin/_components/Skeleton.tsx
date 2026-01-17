"use client";

import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function Skeleton(props: {
  className?: string;
  rounded?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "animate-pulse bg-[#E8DDD4]/60",
        props.rounded ?? "rounded-2xl",
        props.className
      )}
    >
      {props.children}
    </div>
  );
}

export function SkeletonLine(props: { className?: string }) {
  return <Skeleton className={cn("h-3", props.className)} rounded="rounded-full" />;
}

export function SkeletonButton(props: { className?: string }) {
  return <Skeleton className={cn("h-10", props.className)} rounded="rounded-full" />;
}

