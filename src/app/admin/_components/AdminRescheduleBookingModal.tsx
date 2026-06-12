"use client";

import { useEffect, useState } from "react";
import { minutesToAmPmRange } from "../_lib/adminTime";

export type RescheduleBookingTarget = {
  id: string;
  name: string;
  email: string;
  itemId: string;
  itemName: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  slotId: string | null;
};

type SessionOption = {
  id: string;
  label: string;
  available: number;
  selectable: boolean;
};

type Props = {
  target: RescheduleBookingTarget | null;
  onClose: () => void;
  onSuccess?: () => void | Promise<void>;
};

async function fetchRescheduleSlots(
  dateKey: string,
  bookingId: string
): Promise<SessionOption[]> {
  const params = new URLSearchParams({ dateKey, bookingId });
  const res = await fetch(`/api/admin/bookings/reschedule-slots?${params.toString()}`, {
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error?.message ?? "Failed to load sessions");
  }

  const slots = (json.data.slots ?? []) as Array<{
    id: string;
    startMin: number;
    endMin: number;
    available: number;
    capacity: number;
    selectable: boolean;
    blockedByExclusive: boolean;
  }>;

  return slots.map((s) => {
    let suffix = `(${s.available}/${s.capacity})`;
    if (s.blockedByExclusive) suffix = "(blocked)";
    else if (!s.selectable) suffix = "(full)";

    return {
      id: s.id,
      label: `${minutesToAmPmRange(s.startMin, s.endMin)} ${suffix}`,
      available: s.available,
      selectable: s.selectable,
    };
  });
}

export function AdminRescheduleBookingModal({ target, onClose, onSuccess }: Props) {
  const [dateKey, setDateKey] = useState("");
  const [slotId, setSlotId] = useState("");
  const [slots, setSlots] = useState<SessionOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) {
      setDateKey("");
      setSlotId("");
      setSlots([]);
      setError(null);
      return;
    }

    setDateKey(target.dateKey);
    setSlotId("");
    setError(null);
    fetchRescheduleSlots(target.dateKey, target.id)
      .then(setSlots)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load sessions")
      );
  }, [target]);

  if (!target) return null;

  async function onDateChange(nextDateKey: string) {
    if (!target) return;
    setDateKey(nextDateKey);
    setSlotId("");
    setError(null);
    try {
      const options = await fetchRescheduleSlots(nextDateKey, target.id);
      setSlots(options);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sessions");
      setSlots([]);
    }
  }

  const selectableSlots = slots.filter((s) => s.selectable);

  async function save() {
    if (!target || !slotId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/bookings/${encodeURIComponent(target.id)}/reschedule`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slotId }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Failed to reschedule");
      }
      await onSuccess?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reschedule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] px-4 py-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />
      <div className="relative w-full max-w-xl mx-auto rounded-3xl border border-[#E8DDD4] bg-[#FAF8F6] shadow-lg max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col">
        <div className="p-6 overflow-y-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs text-[#716D64]">Reschedule booking</div>
              <div className="font-serif text-xl font-bold">{target.name}</div>
              <div className="text-xs text-[#716D64]">{target.email}</div>
              <div className="mt-2 text-xs text-[#716D64]">
                Current: {target.dateKey} ·{" "}
                {minutesToAmPmRange(target.startMin, target.endMin)}
                {target.itemName ? ` · ${target.itemName}` : ""}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition"
            >
              Close
            </button>
          </div>

          <div className="mt-6 grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">New date</span>
              <input
                type="date"
                value={dateKey}
                onChange={(e) => onDateChange(e.target.value)}
                className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">New session</span>
              <select
                value={slotId}
                onChange={(e) => setSlotId(e.target.value)}
                className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
              >
                <option value="">Select a session…</option>
                {slots.map((s) => (
                  <option key={s.id} value={s.id} disabled={!s.selectable}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            {slots.length === 0 ? (
              <div className="text-xs text-[#716D64]">
                No sessions for this class on the selected date.
              </div>
            ) : selectableSlots.length === 0 ? (
              <div className="text-xs text-[#716D64]">
                Sessions exist but are full or blocked — pick another date or time.
              </div>
            ) : null}
            {error ? <div className="text-sm text-red-700">{error}</div> : null}
            <button
              type="button"
              disabled={!slotId || saving}
              onClick={save}
              className="px-6 py-3 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 transition disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save new date"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
