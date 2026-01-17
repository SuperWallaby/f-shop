"use client";

import { cn } from "@/lib/cn";

export type SelectItem = {
  id: string;
  name: string;
  capacity: number;
  active?: boolean;
};

export function ItemSelectField(props: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  items: SelectItem[];
  loading: boolean;
  error: string | null;
  placeholder?: string;
  className?: string;
}) {
  const placeholder = props.placeholder ?? "Select an item…";

  return (
    <label className={cn("grid gap-1", props.className)}>
      <span className="text-xs text-[#716D64]">{props.label}</span>

      {props.loading ? (
        <div className="text-sm text-[#716D64]">Loading items…</div>
      ) : props.error ? (
        <div className="text-sm text-red-700">{props.error}</div>
      ) : props.items.length === 0 ? (
        <div className="text-sm text-[#716D64]">No items. Create one first.</div>
      ) : (
        <select
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
        >
          <option value="">{placeholder}</option>
          {props.items.map((it) => (
            <option key={it.id} value={it.id}>
              {it.name} (cap {it.capacity}){it.active === false ? " [inactive]" : ""}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}

