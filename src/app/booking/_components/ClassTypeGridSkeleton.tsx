"use client";

import { cn } from "@/lib/cn";
import { Skeleton } from "./Skeleton";

export function ClassTypeCardSkeleton() {
  return (
    <div
      className="rounded-3xl border border-[#E8DDD4] bg-white px-5 py-4 h-full"
      aria-hidden
    >
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-6 w-2/5 max-w-[140px]" rounded="rounded-full" />
        <Skeleton className="mt-1.5 h-3 w-3 shrink-0" rounded="rounded-full" />
      </div>
      <Skeleton className="mt-3 h-3 w-full" rounded="rounded-full" />
      <Skeleton className="mt-1.5 h-3 w-4/5" rounded="rounded-full" />
    </div>
  );
}

export function ClassTypeGridSkeleton({
  count = 5,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch",
        className,
      )}
      aria-busy="true"
      aria-label="Loading class types"
    >
      {Array.from({ length: count }).map((_, i) => (
        <ClassTypeCardSkeleton key={i} />
      ))}
    </div>
  );
}
