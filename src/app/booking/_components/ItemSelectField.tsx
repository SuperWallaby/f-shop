"use client";

import { cn } from "@/lib/cn";
import { Skeleton } from "./Skeleton";

export type PublicItem = {
  id: string;
  name: string;
  description: string;
  capacity: number;
  color?: string;
};

export function ItemSelectField(props: {
  items: PublicItem[];
  value: string;
  onChange: (next: string) => void;
  loading: boolean;
  error: string | null;
  disabledItemIds?: Set<string>;
}) {
  if (props.loading) {
    return <Skeleton className="h-11 w-full" rounded="rounded-2xl" />;
  }
  if (props.error) {
    return <div className="text-sm text-red-700">{props.error}</div>;
  }
  if (props.items.length === 0) {
    return <div className="text-sm text-[#716D64]">No classes configured.</div>;
  }

  return (
    <select
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      className={cn(
        "w-full rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm",
        "outline-none focus:ring-2 focus:ring-[#DFD1C9]"
      )}
    >
      <option value="">All Class</option>
      {props.items.map((it) => (
        <option
          key={it.id}
          value={it.id}
          disabled={Boolean(props.disabledItemIds?.has(it.id))}
        >
          {it.name} (cap {it.capacity})
        </option>
      ))}
    </select>
  );
}

