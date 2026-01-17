"use client";

import { useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { DayPicker } from "react-day-picker";
import { DateTime } from "luxon";
import { BUSINESS_TIME_ZONE, DEFAULT_CAPACITY } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { TabButton } from "./_components/TabButton";
import { ItemSelectField } from "./_components/ItemSelectField";
import { Skeleton, SkeletonButton, SkeletonLine } from "./_components/Skeleton";
import { Switch } from "@/components/Switch";
import { normalizeHexColor, pickUnusedPastelRandom } from "@/lib/itemColor";
import { AdminBookingsView } from "./_components/AdminBookingsView";
import { AdminCalendarView } from "./_components/AdminCalendarView";
import { Pill } from "./_components/Pill";
import type { AdminDaySlot } from "./_lib/types";
import {
 dateToDateKeyBusiness,
 formatLocalTimeRange,
 hhmmToAmPmLabel,
 hhmmToMinutes,
 minutesToAmPmRange,
 minutesToHhmm,
} from "./_lib/adminTime";

export default function AdminPage() {
 const [checking, setChecking] = useState(true);
 const [authed, setAuthed] = useState(false);
 const [password, setPassword] = useState("");
 const [error, setError] = useState<string | null>(null);
 const [submitting, setSubmitting] = useState(false);

 useEffect(() => {
  let cancelled = false;
  async function check() {
   setChecking(true);
   try {
    const res = await fetch("/api/admin/me", { cache: "no-store" });
    const json = await res.json();
    if (!cancelled) setAuthed(Boolean(json?.data?.authed));
   } finally {
    if (!cancelled) setChecking(false);
   }
  }
  check();
  return () => {
   cancelled = true;
  };
 }, []);

 async function login() {
  setSubmitting(true);
  setError(null);
  try {
   const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
   });
   const json = await res.json();
   if (!res.ok || !json?.ok) {
    throw new Error(json?.error?.message ?? "Login failed");
   }
   setAuthed(true);
   setPassword("");
  } catch (e) {
   setError(e instanceof Error ? e.message : "Login failed");
  } finally {
   setSubmitting(false);
  }
 }

 async function logout() {
  await fetch("/api/admin/logout", { method: "POST" });
  setAuthed(false);
 }

 const [tab, setTab] = useState<
  "time" | "config" | "items" | "calendar" | "settings" | "bookings"
 >("time");
 const [selectedDay, setSelectedDay] = useState<Date | undefined>(
  () => new Date()
 );

 const dateKey = useMemo(() => {
  if (!selectedDay) return null;
  return dateToDateKeyBusiness(selectedDay);
 }, [selectedDay]);

 const [dayLoading, setDayLoading] = useState(false);
 const [dayError, setDayError] = useState<string | null>(null);
 const [daySlots, setDaySlots] = useState<AdminDaySlot[]>([]);

 const [adminItems, setAdminItems] = useState<
  Array<{
   id: string;
   name: string;
   description: string;
   capacity: number;
   sortOrder?: number | null;
   color: string;
   autoCancelEnabled: boolean;
   autoCancelMinBookings: number | null;
   autoCancelCutoffHours: number | null;
   exclusiveKey?: string;
   active: boolean;
  }>
 >([]);
 const [adminItemsDraft, setAdminItemsDraft] = useState<typeof adminItems>([]);
 const [adminItemsLoading, setAdminItemsLoading] = useState(false);
 const [adminItemsError, setAdminItemsError] = useState<string | null>(null);
 const [adminItemsSaving, setAdminItemsSaving] = useState(false);
 const [adminItemsSaveMsg, setAdminItemsSaveMsg] = useState<string | null>(null);
 const [adminItemsSaveError, setAdminItemsSaveError] = useState<string | null>(
  null
 );

 async function loadAdminItems() {
  setAdminItemsLoading(true);
  setAdminItemsError(null);
  setAdminItemsSaveMsg(null);
  setAdminItemsSaveError(null);
  try {
   const res = await fetch("/api/admin/items", { cache: "no-store" });
   const json = await res.json();
   if (!res.ok || !json?.ok) {
    throw new Error(json?.error?.message ?? "Failed to load items");
   }
  const next = (json.data.items ?? []) as typeof adminItems;
  // Seed missing sortOrder values in the draft so ordering/reorder works even for legacy docs.
  // (These will be persisted when the user clicks "Save changes".)
  const seeded = next.map((it, idx) => ({
   ...it,
   sortOrder:
    typeof it.sortOrder === "number" && Number.isFinite(it.sortOrder)
     ? it.sortOrder
     : idx + 1,
  }));
  setAdminItems(next);
  setAdminItemsDraft(seeded);
  } catch (e) {
   setAdminItems([]);
   setAdminItemsDraft([]);
   setAdminItemsError(e instanceof Error ? e.message : "Failed to load items");
  } finally {
   setAdminItemsLoading(false);
  }
 }

 const hasAdminItemsChanges = useMemo(() => {
  if (adminItems.length !== adminItemsDraft.length) return true;
  const byId = new Map(adminItems.map((it) => [it.id, it]));
  for (const d of adminItemsDraft) {
   const o = byId.get(d.id);
   if (!o) return true;
   const exO = (o.exclusiveKey ?? "").trim();
   const exD = (d.exclusiveKey ?? "").trim();
   if (
    o.name !== d.name ||
    o.description !== d.description ||
    o.capacity !== d.capacity ||
    (o.sortOrder ?? null) !== (d.sortOrder ?? null) ||
    (o.color ?? "") !== (d.color ?? "") ||
    Boolean(o.autoCancelEnabled) !== Boolean(d.autoCancelEnabled) ||
    (o.autoCancelMinBookings ?? null) !== (d.autoCancelMinBookings ?? null) ||
    (o.autoCancelCutoffHours ?? null) !== (d.autoCancelCutoffHours ?? null) ||
    exO !== exD ||
    o.active !== d.active
   ) {
    return true;
   }
  }
  return false;
 }, [adminItems, adminItemsDraft]);

 // Warn on refresh/close when there are unsaved changes in Class Types.
 useEffect(() => {
  if (tab !== "items") return;
  if (!hasAdminItemsChanges) return;
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
   e.preventDefault();
   // Chrome requires returnValue to be set.
   e.returnValue = "";
  };
  window.addEventListener("beforeunload", onBeforeUnload);
  return () => window.removeEventListener("beforeunload", onBeforeUnload);
 }, [tab, hasAdminItemsChanges]);

 function setTabSafe(
  next: "time" | "config" | "items" | "calendar" | "settings" | "bookings"
 ) {
  if (next === tab) return;
  if (tab === "items" && hasAdminItemsChanges) {
   const ok = window.confirm(
    "You have unsaved changes in Class Types. Leave without saving?"
   );
   if (!ok) return;
  }
  setTab(next);
 }

 async function saveAdminItemsDraft() {
  if (adminItemsSaving) return;
  setAdminItemsSaving(true);
  setAdminItemsSaveMsg(null);
  setAdminItemsSaveError(null);
  try {
   const byId = new Map(adminItems.map((it) => [it.id, it]));
   const ops: Array<Promise<Response>> = [];
   for (const d of adminItemsDraft) {
    const o = byId.get(d.id);
    if (!o) continue;

    const patch: Record<string, unknown> = {};
    const exO = (o.exclusiveKey ?? "").trim();
    const exD = (d.exclusiveKey ?? "").trim();
    if (o.name !== d.name) patch.name = d.name;
    if (o.description !== d.description) patch.description = d.description;
    if (o.capacity !== d.capacity) patch.capacity = d.capacity;
   if ((o.sortOrder ?? null) !== (d.sortOrder ?? null))
    patch.sortOrder = d.sortOrder ?? undefined;
    if ((o.color ?? "") !== (d.color ?? "")) {
     const normalized = normalizeHexColor(d.color);
     if (!normalized) patch.randomizeColor = true; // empty/invalid => auto-pick a valid pastel
     else patch.color = normalized;
    }
    if (Boolean(o.autoCancelEnabled) !== Boolean(d.autoCancelEnabled))
     patch.autoCancelEnabled = Boolean(d.autoCancelEnabled);
    if ((o.autoCancelMinBookings ?? null) !== (d.autoCancelMinBookings ?? null))
     patch.autoCancelMinBookings = d.autoCancelMinBookings ?? undefined;
    if ((o.autoCancelCutoffHours ?? null) !== (d.autoCancelCutoffHours ?? null))
     patch.autoCancelCutoffHours = d.autoCancelCutoffHours ?? undefined;
    if (exO !== exD) patch.exclusiveKey = exD;
    if (o.active !== d.active) patch.active = d.active;

    if (Object.keys(patch).length === 0) continue;
    ops.push(
     fetch(`/api/admin/items/${encodeURIComponent(d.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
     })
    );
   }

   const results = await Promise.all(ops);
   const failed = results.find((r) => !r.ok);
   if (failed) {
    const json = await failed.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Failed to save class types");
   }

   await loadAdminItems();
   setAdminItemsSaveMsg("Saved.");
  } catch (e) {
   setAdminItemsSaveError(
    e instanceof Error ? e.message : "Failed to save class types"
   );
  } finally {
   setAdminItemsSaving(false);
  }
 }

 useEffect(() => {
  if (!authed) return;
  loadAdminItems();
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [authed]);

 async function loadDay(key: string) {
  setDayLoading(true);
  setDayError(null);
  try {
   const res = await fetch(
    `/api/admin/day?dateKey=${encodeURIComponent(key)}`,
    {
     cache: "no-store",
    }
   );
   const json = await res.json();
   if (!res.ok || !json?.ok) {
    throw new Error(json?.error?.message ?? "Failed to load day");
   }
   // timeZone is currently unused in the UI, but kept in API response
   setDaySlots(json.data.slots ?? []);
  } catch (e) {
   setDaySlots([]);
   setDayError(e instanceof Error ? e.message : "Failed to load day");
  } finally {
   setDayLoading(false);
  }
 }

 useEffect(() => {
  if (!authed || !dateKey) return;
  loadDay(dateKey);
 }, [authed, dateKey]);

 useEffect(() => {
 }, [selectedDay, dateKey]);

 const [newStart, setNewStart] = useState("09:00");
 const [newEnd, setNewEnd] = useState("10:00");
 const [newItemId, setNewItemId] = useState<string>("");
 const [createSlotError, setCreateSlotError] = useState<string | null>(null);
 const [creatingSlot, setCreatingSlot] = useState(false);

 useEffect(() => {
  if (newItemId) return;
  const first = adminItems.find((it) => it.active)?.id ?? adminItems[0]?.id;
  if (first) setNewItemId(first);
 }, [adminItems, newItemId]);

 async function createSlot() {
  if (!dateKey) return;
  if (!newItemId) {
   setCreateSlotError("Select a class type");
   return;
  }
  const startMin = hhmmToMinutes(newStart);
  const endMin = hhmmToMinutes(newEnd);
  if (startMin === null || endMin === null) {
   setCreateSlotError("Invalid time format");
   return;
  }
  if (endMin <= startMin) {
   setCreateSlotError("End time must be after start time");
   return;
  }
  setCreatingSlot(true);
  setCreateSlotError(null);
  try {
   const res = await fetch("/api/admin/slots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
     dateKey,
     itemId: newItemId,
     startMin,
     endMin,
    }),
   });
   const json = await res.json();
   if (!res.ok || !json?.ok) {
    throw new Error(json?.error?.message ?? "Failed to create slot");
   }
   await loadDay(dateKey);
  } catch (e) {
   setCreateSlotError(e instanceof Error ? e.message : "Failed to create slot");
  } finally {
   setCreatingSlot(false);
  }
 }

 async function patchSlot(slotId: string, patch: Record<string, unknown>) {
  if (!dateKey) return;
  const res = await fetch(`/api/admin/slots/${encodeURIComponent(slotId)}`, {
   method: "PATCH",
   headers: { "Content-Type": "application/json" },
   body: JSON.stringify(patch),
  });
  const json = await res.json();
  if (!res.ok || !json?.ok) {
   throw new Error(json?.error?.message ?? "Failed to update slot");
  }
  await loadDay(dateKey);
 }

 async function deleteSlotHard(slotId: string) {
  if (!dateKey) return;
  const res = await fetch(
   `/api/admin/slots/${encodeURIComponent(slotId)}/delete`,
   {
    method: "POST",
   }
  );
  const json = await res.json();
  if (!res.ok || !json?.ok) {
   throw new Error(json?.error?.message ?? "Failed to delete slot");
  }
  await loadDay(dateKey);
 }

 async function cancelBooking(bookingId: string) {
  if (!dateKey) return;
  const res = await fetch(
   `/api/admin/bookings/${encodeURIComponent(bookingId)}/cancel`,
   {
    method: "POST",
   }
  );
  const json = await res.json();
  if (!res.ok || !json?.ok) {
   throw new Error(json?.error?.message ?? "Failed to cancel booking");
  }
  await loadDay(dateKey);
 }

 const [adminBookSlotId, setAdminBookSlotId] = useState<string>("");
 const [adminBookName, setAdminBookName] = useState("");
 const [adminBookEmail, setAdminBookEmail] = useState("");
 const [adminBookWhatsapp, setAdminBookWhatsapp] = useState("");
 const [adminBookError, setAdminBookError] = useState<string | null>(null);
 const [adminBooking, setAdminBooking] = useState(false);

 async function adminCreateBooking() {
  if (!dateKey) return;
  setAdminBooking(true);
  setAdminBookError(null);
  try {
   const res = await fetch("/api/admin/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
     slotId: adminBookSlotId,
     name: adminBookName,
     email: adminBookEmail,
     whatsapp: adminBookWhatsapp,
    }),
   });
   const json = await res.json();
   if (!res.ok || !json?.ok) {
    throw new Error(json?.error?.message ?? "Failed to create booking");
   }
   setAdminBookName("");
   setAdminBookEmail("");
   setAdminBookWhatsapp("");
   await loadDay(dateKey);
  } catch (e) {
   setAdminBookError(
    e instanceof Error ? e.message : "Failed to create booking"
   );
  } finally {
   setAdminBooking(false);
  }
 }

 // Configuration state
 const [settingsLoaded, setSettingsLoaded] = useState(false);
 const [settingsLoading, setSettingsLoading] = useState(false);
 const [settingsError, setSettingsError] = useState<string | null>(null);
 const [businessTimeZone, setBusinessTimeZone] =
  useState<string>(BUSINESS_TIME_ZONE);
 const [minNoticeHours, setMinNoticeHours] = useState<number>(0);
 const [maxDaysAhead, setMaxDaysAhead] = useState<number>(90);
 const [patternItemId, setPatternItemId] = useState<string>("");
 const [patternByItemUi, setPatternByItemUi] = useState<
  Record<string, Record<string, Array<{ start: string; end: string }>>>
 >({});
 const [patternClipboard, setPatternClipboard] = useState<{
  itemId: string;
  dayKey: string;
  rows: Array<{ start: string; end: string }>;
 } | null>(null);
 const [savingSettings, setSavingSettings] = useState(false);
 const [saveSettingsMsg, setSaveSettingsMsg] = useState<string | null>(null);

 const [genFrom, setGenFrom] = useState<string>(() =>
  DateTime.now().toFormat("yyyy-LL-dd")
 );
 const [genTo, setGenTo] = useState<string>(() =>
  DateTime.now().plus({ days: 30 }).toFormat("yyyy-LL-dd")
 );
 const [generating, setGenerating] = useState(false);
 const [generateMsg, setGenerateMsg] = useState<string | null>(null);
 const [generateOverlapModal, setGenerateOverlapModal] = useState<{
  open: boolean;
  overlaps: Array<{
   dateKey: string;
   itemId: string;
   newStartMin: number;
   newEndMin: number;
   existingSlotId: string;
   existingStartMin: number;
   existingEndMin: number;
   existingBookedCount: number;
  }>;
  overlapsTruncated?: boolean;
 } | null>(null);
 const [generateReplaceOverlaps, setGenerateReplaceOverlaps] =
  useState<boolean>(false);

 async function loadSettings() {
  setSettingsLoading(true);
  setSettingsError(null);
  try {
   const res = await fetch("/api/admin/settings", { cache: "no-store" });
   const json = await res.json();
   if (!res.ok || !json?.ok) {
    throw new Error(json?.error?.message ?? "Failed to load settings");
   }
   const doc = json.data;
   const tz = doc?.businessTimeZone || businessTimeZone || "UTC";
   setBusinessTimeZone(tz);
   if (doc?.bookingRules) {
    if (typeof doc.bookingRules.minNoticeHours === "number") {
     setMinNoticeHours(doc.bookingRules.minNoticeHours);
    }
    if (typeof doc.bookingRules.maxDaysAhead === "number") {
     setMaxDaysAhead(doc.bookingRules.maxDaysAhead);
    }
   }

   const pattern = (doc?.weeklyPattern ?? {}) as Record<
    string,
    Array<{ startMin: number; endMin: number; itemId: string }>
   >;
   const emptyWeek = () => ({
    "0": [] as Array<{ start: string; end: string }>,
    "1": [] as Array<{ start: string; end: string }>,
    "2": [] as Array<{ start: string; end: string }>,
    "3": [] as Array<{ start: string; end: string }>,
    "4": [] as Array<{ start: string; end: string }>,
    "5": [] as Array<{ start: string; end: string }>,
    "6": [] as Array<{ start: string; end: string }>,
   });
   const nextByItem: Record<
    string,
    Record<string, Array<{ start: string; end: string }>>
   > = {};
   for (const dayKey of Object.keys(pattern)) {
    const rows = pattern[dayKey] ?? [];
    for (const r of rows) {
     const itemId = r.itemId ?? "";
     if (!itemId) continue;
     if (!nextByItem[itemId]) nextByItem[itemId] = emptyWeek();
     (nextByItem[itemId][dayKey] ??= []).push({
      start: minutesToHhmm(r.startMin),
      end: minutesToHhmm(r.endMin),
     });
    }
   }
   // Ensure all class types exist in the UI even if empty.
   for (const it of adminItems) {
    if (!nextByItem[it.id]) nextByItem[it.id] = emptyWeek();
   }
   setPatternByItemUi(nextByItem);
   if (!patternItemId) {
    const first = adminItems.find((it) => it.active)?.id ?? adminItems[0]?.id;
    if (first) setPatternItemId(first);
   }
   setSettingsLoaded(true);
  } catch (e) {
   setSettingsError(e instanceof Error ? e.message : "Failed to load settings");
  } finally {
   setSettingsLoading(false);
  }
 }

 useEffect(() => {
  if (!authed) return;
  if (tab !== "config") return;
  if (settingsLoaded) return;
  loadSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [authed, tab]);

 const WEEKDAYS: Array<{ key: string; label: string }> = [
  { key: "0", label: "Sun" },
  { key: "1", label: "Mon" },
  { key: "2", label: "Tue" },
  { key: "3", label: "Wed" },
  { key: "4", label: "Thu" },
  { key: "5", label: "Fri" },
  { key: "6", label: "Sat" },
 ];

 function ensurePatternItem(itemId: string) {
  if (!itemId) return;
  setPatternByItemUi((prev) => {
   if (prev[itemId]) return prev;
   return {
    ...prev,
    [itemId]: {
     "0": [],
     "1": [],
     "2": [],
     "3": [],
     "4": [],
     "5": [],
     "6": [],
    },
   };
  });
 }

 function addPatternRow(itemId: string, dayKey: string) {
  if (!itemId) return;
  ensurePatternItem(itemId);
  setPatternByItemUi((prev) => ({
   ...prev,
   [itemId]: {
    ...(prev[itemId] ?? {}),
   [dayKey]: [
    ...(prev[itemId]?.[dayKey] ?? []),
    { start: "09:00", end: "10:00" },
   ],
   },
  }));
 }

 function removePatternRow(itemId: string, dayKey: string, idx: number) {
  if (!itemId) return;
  setPatternByItemUi((prev) => ({
   ...prev,
   [itemId]: {
    ...(prev[itemId] ?? {}),
    [dayKey]: (prev[itemId]?.[dayKey] ?? []).filter((_, i) => i !== idx),
   },
  }));
 }

 function copyPatternDay(dayKey: string) {
  if (!patternItemId) return;
  const rows = (patternByItemUi[patternItemId]?.[dayKey] ?? []).map((r) => ({
   start: r.start,
   end: r.end,
  }));
  setPatternClipboard({ itemId: patternItemId, dayKey, rows });
 }

 function pastePatternDay(dayKey: string) {
  if (!patternItemId) return;
  if (!patternClipboard) return;
  const existing = patternByItemUi[patternItemId]?.[dayKey] ?? [];
  if (existing.length > 0) {
   const ok = window.confirm("Replace this weekday pattern with the copied one?");
   if (!ok) return;
  }
  ensurePatternItem(patternItemId);
  setPatternByItemUi((prev) => {
   const nextItem = { ...(prev[patternItemId] ?? {}) };
   nextItem[dayKey] = patternClipboard.rows.map((r) => ({
    start: r.start,
    end: r.end,
   }));
   return { ...prev, [patternItemId]: nextItem };
  });
 }

 async function saveSettings() {
  setSavingSettings(true);
  setSaveSettingsMsg(null);
  try {
   const weeklyPattern: Record<
    string,
    Array<{ startMin: number; endMin: number; itemId: string }>
   > = {};
   for (const { key } of WEEKDAYS) {
    const merged: Array<{ startMin: number; endMin: number; itemId: string }> =
     [];
    for (const itemId of Object.keys(patternByItemUi)) {
     const rows = patternByItemUi[itemId]?.[key] ?? [];
     for (const r of rows) {
      const startMin = hhmmToMinutes(r.start);
      const endMin = hhmmToMinutes(r.end);
      if (startMin === null || endMin === null) {
       throw new Error(`Invalid time in ${key}`);
      }
      if (endMin <= startMin) {
       throw new Error(`End must be after start in ${key}`);
      }
      if (!itemId) throw new Error(`Select class type in ${key}`);
      merged.push({ startMin, endMin, itemId });
     }
    }
    merged.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin || a.itemId.localeCompare(b.itemId));
    weeklyPattern[key] = merged;
   }

   const res = await fetch("/api/admin/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
     businessTimeZone,
     weeklyPattern,
     bookingRules: { minNoticeHours, maxDaysAhead },
    }),
   });
   const json = await res.json();
   if (!res.ok || !json?.ok) {
    throw new Error(json?.error?.message ?? "Failed to save settings");
   }
   setSaveSettingsMsg("Saved");
   setSettingsLoaded(false); // refetch on demand
  } catch (e) {
   setSaveSettingsMsg(
    e instanceof Error ? e.message : "Failed to save settings"
   );
  } finally {
   setSavingSettings(false);
  }
 }

 async function generateSlots() {
  setGenerating(true);
  setGenerateMsg(null);
  try {
   const doRequest = async (opts?: { force?: boolean; replaceOverlaps?: boolean }) => {
    const res = await fetch("/api/admin/generate-slots", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({
      fromDateKey: genFrom,
      toDateKey: genTo,
      force: Boolean(opts?.force),
      replaceOverlaps: Boolean(opts?.replaceOverlaps),
     }),
    });
    const json = await res.json();
    return { res, json };
   };

   const { res, json } = await doRequest({ force: false });
   if (!res.ok || !json?.ok) {
    if (res.status === 409) {
     const overlaps = (json?.error?.details?.overlaps ?? []) as Array<{
      dateKey: string;
      itemId: string;
      newStartMin: number;
      newEndMin: number;
      existingSlotId: string;
      existingStartMin: number;
      existingEndMin: number;
      existingBookedCount: number;
     }>;
     const overlapsTruncated = Boolean(json?.error?.details?.overlapsTruncated);
     setGenerateReplaceOverlaps(false);
     setGenerateOverlapModal({ open: true, overlaps, overlapsTruncated });
     return;
    }
    throw new Error(json?.error?.message ?? "Failed to generate sessions");
   }

   setGenerateMsg(
    `Generated ${json.data.generated ?? 0} · Added ${json.data.added ?? 0} · Existing ${
     json.data.existing ?? 0
    }`
   );
  } catch (e) {
   setGenerateMsg(
    e instanceof Error ? e.message : "Failed to generate sessions"
   );
  } finally {
   setGenerating(false);
  }
 }

 if (checking) {
  return (
   <div className="min-h-screen bg-[#FAF8F6] text-[#444444] px-6 py-24">
    <SiteHeader />
    <main className="max-w-xl mx-auto mt-16 text-sm text-[#716D64]">
     Loading…
    </main>
   </div>
  );
 }

 if (!authed) {
  return (
   <div className="min-h-screen bg-[#FAF8F6] text-[#444444] px-6 py-24">
    <SiteHeader />
    <main className="max-w-xl mx-auto mt-16">
     <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-8 shadow-sm">
      <h1 className="font-serif text-2xl font-bold mb-3">Admin</h1>
      <p className="text-sm text-[#716D64] mb-6">Enter the admin password.</p>
      <label className="grid gap-1">
       <span className="text-xs text-[#716D64]">Password</span>
       <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
        placeholder="••••••••"
       />
      </label>
      {error ? <div className="mt-3 text-sm text-red-700">{error}</div> : null}
      <button
       disabled={!password || submitting}
       onClick={login}
       className="mt-6 px-6 py-3 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
       {submitting ? "Signing in…" : "Sign in"}
      </button>
     </div>
    </main>
   </div>
  );
 }

 return (
  <div className="min-h-screen bg-[#FAF8F6] text-[#444444] px-6 py-24">
   <SiteHeader />
   <main className="max-w-5xl mx-auto mt-16 space-y-6">
    <div className="flex items-center justify-between">
     <h1 className="font-serif text-3xl font-bold">Admin</h1>
     <button
      onClick={logout}
      className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition"
     >
      Logout
     </button>
    </div>

    <div className="flex gap-2 flex-wrap">
     {(
      [
       { key: "time", label: "Time manage" },
       { key: "config", label: "Pattern" },
       { key: "items", label: "Class Types" },
       { key: "calendar", label: "Calendar" },
       { key: "settings", label: "Settings" },
       { key: "bookings", label: "Bookings" },
      ] as const
     ).map((t) => (
      <TabButton
       key={t.key}
       active={tab === t.key}
       onClick={() => setTabSafe(t.key)}
      >
       {t.label}
      </TabButton>
     ))}
    </div>

    {tab === "time" ? (
     <div className="grid gap-8 md:grid-cols-[360px_1fr] items-start">
      <section className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
       <h2 className="font-serif text-xl font-semibold mb-4">Calendar</h2>
       <DayPicker
        mode="single"
        selected={selectedDay}
        onSelect={setSelectedDay}
        weekStartsOn={0}
       />
      </section>

      <section className="space-y-6">
       <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
        <div className="flex items-baseline justify-between gap-4">
         <h2 className="font-serif text-xl font-semibold">Create Session</h2>
        </div>

        {!!dayLoading && (
         <div className="mt-4 space-y-3">
          <SkeletonLine className="w-40" />
          <div className="grid gap-3 sm:grid-cols-2">
           <Skeleton className="h-11 rounded-2xl" />
           <Skeleton className="h-11 rounded-2xl" />
           <Skeleton className="h-11 rounded-2xl sm:col-span-2" />
          </div>
         </div>
        )}
        {!!dayError && (
         <div className="mt-4 text-sm text-red-700">{dayError}</div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
         <label className="grid gap-1">
          <span className="text-xs text-[#716D64]">Start (24h)</span>
          <input
           value={newStart}
           onChange={(e) => setNewStart(e.target.value)}
           className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
           placeholder="09:00"
          />
          <span className="text-[11px] text-[#716D64]">
           {hhmmToAmPmLabel(newStart) ?? ""}
          </span>
         </label>
         <label className="grid gap-1">
          <span className="text-xs text-[#716D64]">End (24h)</span>
          <input
           value={newEnd}
           onChange={(e) => setNewEnd(e.target.value)}
           className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
           placeholder="10:00"
          />
          <span className="text-[11px] text-[#716D64]">
           {hhmmToAmPmLabel(newEnd) ?? ""}
          </span>
         </label>
         <ItemSelectField
          className="sm:col-span-2"
          label="Class Type"
          value={newItemId}
          onChange={setNewItemId}
          items={adminItems}
          loading={adminItemsLoading}
          error={adminItemsError}
          placeholder="Select a class type…"
         />
        </div>
        {createSlotError ? (
         <div className="mt-3 text-sm text-red-700">{createSlotError}</div>
        ) : null}
        <button
         disabled={!dateKey || !newItemId || creatingSlot}
         onClick={createSlot}
         className="mt-4 px-6 py-3 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
         {creatingSlot ? "Creating…" : "Create session"}
        </button>
       </div>

       <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
        <h2 className="font-serif text-xl font-semibold mb-4">Sessions</h2>
        {!!dayLoading && (
         <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
           <div
            key={i}
            className="rounded-3xl border border-[#E8DDD4] bg-white p-5"
           >
            <div className="flex items-start justify-between gap-4">
             <div className="min-w-0 flex-1 space-y-2">
              <SkeletonLine className="w-48" />
              <SkeletonLine className="w-64" />
             </div>
             <div className="shrink-0 space-y-2">
              <SkeletonButton className="w-28" />
              <SkeletonButton className="w-20" />
             </div>
            </div>
           </div>
          ))}
         </div>
        )}
        {!dayLoading && daySlots.length === 0 ? (
         <div className="text-sm text-[#716D64]">
          No sessions for this date.
         </div>
        ) : (
         <div className="space-y-4">
          {daySlots.map((s) => (
           <div
            key={s.id}
            className="rounded-3xl border border-[#E8DDD4] p-5"
            style={{
             backgroundColor: s.cancelled
              ? "rgba(255,255,255,0.9)"
              :  "rgba(255,255,255,0.9)",
            }}
           >
            <div className="flex items-start justify-between gap-4">
             <div>
              <div className="text-sm font-medium">
               {formatLocalTimeRange(s.startUtc, s.endUtc)}{" "}
              </div>
              <div className="text-xs text-[#716D64] mt-1">
               {s.bookedCount}/{s.capacity} booked · {s.available} available
               <span className="ml-2">
                <Pill
                 label={
                  s.cancelled
                   ? "cancelled"
                   : s.bookedCount >= s.capacity
                   ? "full"
                   : "open"
                 }
                 tone={
                  s.cancelled
                   ? "muted"
                   : s.bookedCount >= s.capacity
                   ? "warn"
                   : "good"
                 }
                />
               </span>
              </div>
              {s.notes ? (
               <div className="text-xs text-[#716D64] mt-1">{s.notes}</div>
              ) : null}
             </div>
             <div className="flex items-center gap-2">
              <button
               onClick={() => patchSlot(s.id, { cancelled: !s.cancelled })}
               className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition"
              >
               {s.cancelled ? "Uncancel" : "Cancel session"}
              </button>
              {s.cancelled ? (
               <button
                onClick={() => {
                  const ok = window.confirm(
                   "Delete this cancelled session? Bookings will become unassigned."
                  );
                 if (ok) deleteSlotHard(s.id).catch(() => {});
                }}
                className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-[#F3ECE6] text-sm hover:brightness-95 transition"
               >
                Delete
               </button>
              ) : null}
             </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
             <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">Start (24h)</span>
              <input
               defaultValue={minutesToHhmm(s.startMin)}
               onBlur={(e) => {
                const startMin = hhmmToMinutes(e.target.value);
                if (startMin === null) return;
                if (startMin === s.startMin) return;
                patchSlot(s.id, { startMin }).catch(() => {});
               }}
               className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
               placeholder="09:00"
              />
             </label>
             <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">End (24h)</span>
              <input
               defaultValue={minutesToHhmm(s.endMin)}
               onBlur={(e) => {
                const endMin = hhmmToMinutes(e.target.value);
                if (endMin === null) return;
                if (endMin === s.endMin) return;
                patchSlot(s.id, { endMin }).catch(() => {});
               }}
               className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
               placeholder="10:00"
              />
             </label>
             <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs text-[#716D64]">Class Type</span>
              {adminItems.length === 0 ? (
               <div className="text-sm text-[#716D64]">No class types.</div>
              ) : (
               <select
                value={s.itemId ?? ""}
                onChange={(e) => {
                 const v = e.target.value;
                 patchSlot(s.id, { itemId: v }).catch(() => {});
                }}
                className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
               >
                <option value="">Select…</option>
                {adminItems.map((it) => (
                 <option key={it.id} value={it.id}>
                  {it.name} (cap {it.capacity}){it.active ? "" : " [inactive]"}
                 </option>
                ))}
               </select>
              )}
             </label>
            </div>

            <div className="mt-4">
             <div className="text-xs font-semibold text-[#716D64] mb-2">
              Bookings
             </div>
             {s.bookings.length === 0 ? (
              <div className="text-sm text-[#716D64]">No bookings.</div>
             ) : (
              <div className="space-y-2">
               {s.bookings.map((b) => (
                <div
                 key={b.id}
                 className="flex items-center justify-between gap-3 rounded-2xl border border-[#E8DDD4] px-4 py-3"
                 style={{
                  backgroundColor:
                   b.status === "cancelled"
                    ? "rgba(255,255,255,0.55)"
                    : s.itemColor
                    ? "rgba(255,255,255,0.55)"
                    : "rgba(255,255,255,0.6)",
                 }}
                >
                 <div className="text-sm">
                  <div className="font-medium">{b.name}</div>
                  <div className="text-xs text-[#716D64]">{b.email}</div>
                 </div>
                 <div className="flex items-center gap-2">
                  <div className="text-xs text-[#716D64]">
                   {b.status === "confirmed" ? "booked" : "cancelled"}
                  </div>
                  {b.status === "confirmed" ? (
                   <button
                    onClick={() => cancelBooking(b.id)}
                    className="px-3 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-xs hover:shadow-sm transition"
                   >
                    Cancel
                   </button>
                  ) : null}
                 </div>
                </div>
               ))}
              </div>
             )}
            </div>
           </div>
          ))}
         </div>
        )}
       </div>

       <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
        <h2 className="font-serif text-xl font-semibold mb-4">
         Create booking
        </h2>
        <div className="grid gap-3">
         <label className="grid gap-1">
          <span className="text-xs text-[#716D64]">Session</span>
          <select
           value={adminBookSlotId}
           onChange={(e) => setAdminBookSlotId(e.target.value)}
           className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
          >
           <option value="">Select a session…</option>
           {daySlots
            .filter((s) => !s.cancelled && s.available > 0)
            .map((s) => (
             <option key={s.id} value={s.id}>
              {formatLocalTimeRange(s.startUtc, s.endUtc)} ({s.available} left)
             </option>
            ))}
          </select>
         </label>
         {!!adminBookSlotId && (
          <>
           <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">Name</span>
            <input
             value={adminBookName}
             onChange={(e) => setAdminBookName(e.target.value)}
             className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
            />
           </label>
           <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">Email</span>
            <input
             value={adminBookEmail}
             onChange={(e) => setAdminBookEmail(e.target.value)}
             className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
             inputMode="email"
            />
           </label>
           <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">WhatsApp</span>
            <input
             value={adminBookWhatsapp}
             onChange={(e) => setAdminBookWhatsapp(e.target.value)}
             className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
             placeholder="+60 12-345 6789"
             inputMode="tel"
            />
           </label>
           {adminBookError ? (
            <div className="text-sm text-red-700">{adminBookError}</div>
           ) : null}
           <button
            disabled={
             !adminBookName ||
             !adminBookEmail ||
             !adminBookWhatsapp ||
             adminBooking
            }
            onClick={adminCreateBooking}
            className="px-6 py-3 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
           >
            {adminBooking ? "Creating…" : "Create booking"}
           </button>
          </>
         )}
        </div>
       </div>
      </section>
     </div>
    ) : tab === "config" ? (
     <div className="space-y-6">
      <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
       <div className="flex items-start justify-between gap-4">
        <div>
         <h2 className="font-serif text-xl font-semibold">Weekly pattern</h2>
         <div className="text-xs text-[#716D64] mt-1">
          Sessions are generated from this pattern, but existing sessions won’t
          be changed.
         </div>
        </div>
        <button
         onClick={loadSettings}
         disabled={settingsLoading}
         className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition disabled:opacity-50"
        >
         {settingsLoading ? "Loading…" : "Reload"}
        </button>
       </div>

       {/* <div className="mt-5 grid gap-3">
        <div className="grid gap-1">
         <span className="text-xs text-[#716D64]">Business timezone</span>
         <div className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm text-[#444444]">
          {BUSINESS_TIME_ZONE}
         </div>
         <div className="text-[11px] text-[#716D64]">
          Fixed (Malaysia). Server time + slot generation use this timezone.
         </div>
        </div>
       </div> */}

       {!!settingsLoading && (
        <div className="mt-5 space-y-4">
         {Array.from({ length: 3 }).map((_, i) => (
          <div
           key={i}
           className="rounded-3xl border border-[#E8DDD4] bg-white p-5"
          >
           <div className="flex items-center justify-between">
            <SkeletonLine className="w-12" />
            <SkeletonButton className="w-20" />
           </div>
           <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <Skeleton className="h-11 rounded-2xl" />
            <Skeleton className="h-11 rounded-2xl" />
            <Skeleton className="h-11 rounded-2xl" />
            <SkeletonButton className="h-11 w-full rounded-2xl" />
           </div>
          </div>
         ))}
        </div>
       )}

       {!!settingsError && (
        <div className="mt-3 text-sm text-red-700">{settingsError}</div>
       )}

       {!settingsLoading && (
        <div className="mt-6 space-y-6">
         <div className="rounded-3xl border border-[#E8DDD4] bg-white p-5">
          <div className="font-serif font-semibold">Class Type</div>
          <div className="text-xs text-[#716D64] mt-1">
           Weekly pattern is configured per class type.
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
           {adminItems.length === 0 ? (
            <div className="text-sm text-[#716D64]">No class types.</div>
           ) : (
            adminItems
             .slice()
             .sort(
              (a, b) =>
               Number(b.active) - Number(a.active) ||
               a.name.localeCompare(b.name)
             )
             .map((it) => (
              <button
               key={it.id}
               type="button"
               onClick={() => setPatternItemId(it.id)}
               style={
                it.color
                 ? patternItemId === it.id
                   ? { backgroundColor: it.color }
                   : { borderColor: it.color }
                 : undefined
               }
               className={cn(
                "px-4 py-2 rounded-full border text-sm transition cursor-pointer whitespace-nowrap inline-flex items-center gap-2",
                patternItemId === it.id
                 ? "text-[#444444]"
                 : "border-[#E8DDD4] bg-white/80 text-[#444444] hover:shadow-sm"
               )}
              >
               {!!it.color && (
                <span
                 className="inline-block h-2.5 w-2.5 rounded-full border border-black/10"
                 style={{ backgroundColor: it.color }}
                />
               )}
               {it.name}
              </button>
             ))
           )}
          </div>
         </div>
         {WEEKDAYS.map((d) => (
          <div
           key={d.key}
           className="rounded-3xl border border-[#E8DDD4] bg-white p-5"
          >
           <div className="flex items-center justify-between">
            <div className="font-serif font-semibold">{d.label}</div>
            <div className="flex items-center gap-2">
             <button
              type="button"
              disabled={!patternItemId}
              onClick={() => copyPatternDay(d.key)}
              className="px-3 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-xs hover:shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
             >
              Copy
             </button>
             <button
              type="button"
              disabled={!patternItemId || !patternClipboard}
              onClick={() => pastePatternDay(d.key)}
              className="px-3 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-xs hover:shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
             >
              Paste
             </button>
             <button
              type="button"
              disabled={!patternItemId}
              onClick={() => addPatternRow(patternItemId, d.key)}
              className="px-3 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-xs hover:shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
             >
              Add
             </button>
            </div>
           </div>

           {!patternItemId ? (
            <div className="mt-3 text-sm text-[#716D64]">
             Select a class type above.
            </div>
           ) : (patternByItemUi[patternItemId]?.[d.key] ?? []).length === 0 ? (
            <div className="mt-3 text-sm text-[#716D64]"></div>
           ) : (
            <div className="mt-3 space-y-3">
             {(patternByItemUi[patternItemId]?.[d.key] ?? []).map((row, idx) => (
              <div key={idx} className="grid gap-3 sm:grid-cols-4 items-end">
               <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">Start (24h)</span>
                <input
                 value={row.start}
                 onChange={(e) => {
                  const v = e.target.value;
                  if (!patternItemId) return;
                  setPatternByItemUi((prev) => {
                   const nextItem = { ...(prev[patternItemId] ?? {}) };
                   const nextRows = [...(nextItem[d.key] ?? [])];
                   nextRows[idx] = { ...nextRows[idx], start: v };
                   nextItem[d.key] = nextRows;
                   return { ...prev, [patternItemId]: nextItem };
                  });
                 }}
                 className="rounded-2xl border min-w-0 border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
                />
               </label>
               <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">End (24h)</span>
                <input
                 value={row.end}
                 onChange={(e) => {
                  const v = e.target.value;
                  if (!patternItemId) return;
                  setPatternByItemUi((prev) => {
                   const nextItem = { ...(prev[patternItemId] ?? {}) };
                   const nextRows = [...(nextItem[d.key] ?? [])];
                   nextRows[idx] = { ...nextRows[idx], end: v };
                   nextItem[d.key] = nextRows;
                   return { ...prev, [patternItemId]: nextItem };
                  });
                 }}
                 className="rounded-2xl min-w-0 border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
                />
               </label>
               <div className="hidden sm:block" />
               <button
                type="button"
                onClick={() => removePatternRow(patternItemId, d.key, idx)}
                className="mt-5 px-4 py-2 rounded-full border border-[#E8DDD4] bg-[#F3ECE6] text-xs text-[#7A4B3A] hover:brightness-95 transition cursor-pointer"
               >
                Remove
               </button>
              </div>
             ))}
            </div>
           )}
          </div>
         ))}
        </div>
       )}

       {!!saveSettingsMsg && (
        <div className="mt-4 text-sm text-[#716D64]">{saveSettingsMsg}</div>
       )}
       <button
        onClick={saveSettings}
        disabled={savingSettings}
        className="mt-5 px-6 py-3 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 transition disabled:opacity-50"
       >
        {savingSettings ? "Saving…" : "Save configuration"}
       </button>
      </div>

      <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
       <h2 className="font-serif text-xl font-semibold mb-4">
        Generate sessions
       </h2>
       <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
         <span className="text-xs text-[#716D64]">From</span>
         <input
          type="date"
          value={genFrom}
          onChange={(e) => setGenFrom(e.target.value)}
          className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
         />
        </label>
        <label className="grid gap-1">
         <span className="text-xs text-[#716D64]">To</span>
         <input
          type="date"
          value={genTo}
          onChange={(e) => setGenTo(e.target.value)}
          className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
         />
        </label>
       </div>
       {!!generating && (
        <div className="mt-3 space-y-2">
         <SkeletonLine className="w-72" />
        </div>
       )}
       {!!generateMsg && (
        <div className="mt-3 text-sm text-[#716D64]">{generateMsg}</div>
       )}
       <button
        onClick={generateSlots}
        disabled={generating}
        className="mt-4 px-6 py-3 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 transition disabled:opacity-50"
       >
        {generating ? "Generating…" : "Generate"}
       </button>

       {generateOverlapModal?.open ? (
        <div
         className="fixed inset-0 z-[120] px-4 py-6 overflow-y-auto flex items-start md:items-center justify-center"
         role="dialog"
         aria-modal="true"
         onMouseDown={(e) => {
          if (e.target === e.currentTarget)
           setGenerateOverlapModal((v) => (v ? { ...v, open: false } : v));
         }}
        >
         <div className="absolute inset-0 bg-black/30 pointer-events-none" />
         <div className="relative w-full max-w-3xl mx-auto rounded-3xl border border-[#E8DDD4] bg-[#FAF8F6] shadow-lg overflow-hidden flex flex-col">
          <div className="p-6 overflow-y-auto max-h-[calc(100vh-3rem)]">
           <div className="flex items-start justify-between gap-4">
            <div>
             <h3 className="font-serif text-2xl font-bold">Overlapping sessions</h3>
             <div className="mt-2 text-sm text-[#716D64]">
              These overlaps are checked within the same class type only.
             </div>
            </div>
            <button
             type="button"
             onClick={() =>
              setGenerateOverlapModal((v) => (v ? { ...v, open: false } : v))
             }
             className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
            >
             Close
            </button>
           </div>

           <div className="mt-5 rounded-3xl border border-[#E8DDD4] bg-white/70 p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
             <div className="text-sm text-[#444444] font-medium">
              {generateOverlapModal.overlaps.length} overlap(s) shown
              {generateOverlapModal.overlapsTruncated ? " (truncated)" : ""}
             </div>
             <Switch
              checked={generateReplaceOverlaps}
              onCheckedChange={setGenerateReplaceOverlaps}
              label="Replace overlaps (delete existing)"
             />
            </div>
            {generateReplaceOverlaps ? (
             <div className="mt-3 text-xs text-[#A66A4A]">
              Deleting sessions can detach existing bookings.
             </div>
            ) : null}

            <div className="mt-4 max-h-[45vh] overflow-y-auto rounded-2xl border border-[#E8DDD4] bg-white">
             <div className="divide-y divide-[#E8DDD4]">
              {generateOverlapModal.overlaps.map((o, idx) => {
               const itemName =
                adminItems.find((it) => it.id === o.itemId)?.name ?? o.itemId;
               return (
                <div key={idx} className="px-4 py-3 text-sm">
                 <div className="text-xs text-[#716D64]">{o.dateKey}</div>
                 <div className="mt-1 flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="font-medium text-[#444444]">{itemName}</div>
                  <div className="text-xs text-[#716D64]">
                   booked: {o.existingBookedCount}
                  </div>
                 </div>
                 <div className="mt-2 text-sm text-[#444444]">
                  New: {minutesToAmPmRange(o.newStartMin, o.newEndMin)}{" "}
                  <span className="text-[#716D64]">overlaps</span> Existing:{" "}
                  {minutesToAmPmRange(o.existingStartMin, o.existingEndMin)}
                 </div>
                </div>
               );
              })}
             </div>
            </div>
           </div>

           <div className="mt-5 flex items-center justify-end gap-2">
            <button
             type="button"
             onClick={() => {
              setGenerateOverlapModal((v) => (v ? { ...v, open: false } : v));
              setGenerateMsg("Cancelled");
             }}
             className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
            >
             Cancel
            </button>
            <button
             type="button"
             onClick={async () => {
              setGenerateOverlapModal((v) => (v ? { ...v, open: false } : v));
              setGenerating(true);
              setGenerateMsg(null);
              try {
               const res = await fetch("/api/admin/generate-slots", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                 fromDateKey: genFrom,
                 toDateKey: genTo,
                 force: true,
                 replaceOverlaps: Boolean(generateReplaceOverlaps),
                }),
               });
               const json = await res.json();
               if (!res.ok || !json?.ok) {
                throw new Error(
                 json?.error?.message ?? "Failed to generate sessions"
                );
               }
               setGenerateMsg(
                `Added sessions ${json.data.added ?? 0} · Existing sessions ${
                 json.data.existing ?? 0
                }${
                 json.data.deletedOverlaps
                  ? ` · Deleted overlaps ${json.data.deletedOverlaps}`
                  : ""
                }${
                 json.data.duplicatesIgnored
                  ? ` · Ignored duplicates ${json.data.duplicatesIgnored}`
                  : ""
                }`
               );
              } catch (e) {
               setGenerateMsg(
                e instanceof Error ? e.message : "Failed to generate sessions"
               );
              } finally {
               setGenerating(false);
              }
             }}
             className="px-6 py-3 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 transition cursor-pointer"
            >
             {generateReplaceOverlaps ? "Delete overlaps & generate" : "Ignore & generate"}
            </button>
           </div>
          </div>
         </div>
        </div>
       ) : null}
      </div>
     </div>
    ) : tab === "items" ? (
     <section className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
       <div>
        <h2 className="font-serif text-2xl font-semibold">Class Types</h2>
        <div className="text-xs text-[#716D64] mt-1">
         Capacity is defined on the class type and applied to all its sessions.
        </div>
        {hasAdminItemsChanges ? (
         <div className="text-xs text-[#A66A4A] mt-2">Unsaved changes</div>
        ) : null}
       </div>
       <button
        onClick={() => {
         if (hasAdminItemsChanges) {
          const ok = window.confirm(
           "You have unsaved changes. Reload and discard them?"
          );
          if (!ok) return;
         }
         loadAdminItems();
        }}
        disabled={adminItemsLoading || adminItemsSaving}
        className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
       >
        {adminItemsLoading ? "Loading…" : "Reload"}
       </button>
      </div>

      {!!adminItemsLoading && (
       <div className="mt-6 space-y-4">
        <div className="rounded-3xl border border-[#E8DDD4] bg-white p-5">
         <SkeletonLine className="w-32 mb-3" />
         <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-11 rounded-2xl" />
          <Skeleton className="h-11 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl sm:col-span-2" />
          <SkeletonButton className="w-full sm:col-span-2" />
         </div>
        </div>
        <div className="rounded-3xl border border-[#E8DDD4] bg-white p-5">
         <SkeletonLine className="w-28 mb-3" />
         <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
           <div
            key={i}
            className="rounded-3xl border border-[#E8DDD4] bg-[#FAF8F6] p-5"
           >
            <SkeletonLine className="w-52" />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
             <Skeleton className="h-11 rounded-2xl" />
             <Skeleton className="h-11 rounded-2xl" />
             <Skeleton className="h-24 rounded-2xl sm:col-span-2" />
            </div>
           </div>
          ))}
         </div>
        </div>
       </div>
      )}

      {!!adminItemsError && (
       <div className="mt-4 text-sm text-red-700">{adminItemsError}</div>
      )}
      {!!adminItemsSaveError && (
       <div className="mt-4 text-sm text-red-700">{adminItemsSaveError}</div>
      )}
      {!!adminItemsSaveMsg && (
       <div className="mt-4 text-sm text-[#716D64]">{adminItemsSaveMsg}</div>
      )}

      {!adminItemsLoading && (
       <div className="mt-6 grid gap-4">
        <div className="rounded-3xl border border-[#E8DDD4] bg-white p-5">
         <div className="font-serif font-semibold mb-3">Create class type</div>
         <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
           <span className="text-xs text-[#716D64]">Name</span>
           <input
            id="createItemName"
            className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
            placeholder="Class type name"
           />
          </label>
          <label className="grid gap-1">
           <span className="text-xs text-[#716D64]">Capacity</span>
           <input
            id="createItemCap"
            type="number"
            min={1}
            defaultValue={DEFAULT_CAPACITY}
            className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
           />
          </label>
          <label className="grid gap-1 sm:col-span-2">
           <span className="text-xs text-[#716D64]">Description</span>
           <textarea
            id="createItemDesc"
            rows={3}
            className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
            placeholder="Description (optional)"
           />
          </label>
          <label className="grid gap-1 sm:col-span-2">
           <span className="text-xs text-[#716D64]">Linked key (optional)</span>
           <input
            id="createItemExclusiveKey"
            className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
            placeholder="e.g. GROUP-A (same key = mutually exclusive at same time)"
           />
           <div className="text-[11px] text-[#716D64]">
            If two class types share the same linked key, one booking will block
            all others at the same date/time.
           </div>
          </label>
          <button
           type="button"
           onClick={async () => {
            const nameEl = document.getElementById(
             "createItemName"
            ) as HTMLInputElement | null;
            const capEl = document.getElementById(
             "createItemCap"
            ) as HTMLInputElement | null;
            const descEl = document.getElementById(
             "createItemDesc"
            ) as HTMLTextAreaElement | null;
            const exEl = document.getElementById(
             "createItemExclusiveKey"
            ) as HTMLInputElement | null;
            const name = nameEl?.value ?? "";
            const capacity = Number(capEl?.value ?? DEFAULT_CAPACITY);
            const description = descEl?.value ?? "";
            const exclusiveKey = (exEl?.value ?? "").trim();
            if (!name.trim()) return;
            const res = await fetch("/api/admin/items", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({
              name,
              capacity,
              description,
              exclusiveKey: exclusiveKey || undefined,
              autoCancelEnabled: false,
              active: true,
             }),
            });
            const json = await res.json();
            if (res.ok && json?.ok) {
             if (nameEl) nameEl.value = "";
             if (descEl) descEl.value = "";
             if (exEl) exEl.value = "";
             await loadAdminItems();
            }
           }}
           className="sm:col-span-2 px-6 py-3 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 transition"
          >
           Create
          </button>
         </div>
        </div>

        <div className="rounded-3xl border border-[#E8DDD4] bg-white p-5">
         <div className="font-serif font-semibold mb-3">All class types</div>
         {adminItemsDraft.length === 0 ? (
          <div className="text-sm text-[#716D64]">No class types yet.</div>
         ) : (
          <div className="space-y-4">
           {adminItemsDraft
            .slice()
            .sort(
             (a, b) =>
              Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) ||
              a.name.localeCompare(b.name)
            )
            .map((it, idx, list) => (
            <div
             key={it.id}
             className="rounded-3xl border border-[#E8DDD4] bg-[#FAF8F6] p-5"
            >
             <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
               <div className="text-sm font-semibold truncate">{it.name}</div>
               <div className="text-xs text-[#716D64]">
                Capacity: {it.capacity}
               </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
               <div className="flex items-center gap-1">
                <button
                 type="button"
                 disabled={adminItemsSaving || idx === 0}
                 onClick={() => {
                  if (idx === 0) return;
                  const prevIt = list[idx - 1];
                  setAdminItemsDraft((prev) =>
                   prev.map((x) => {
                    if (x.id === it.id)
                     return { ...x, sortOrder: prevIt.sortOrder ?? 0 };
                    if (x.id === prevIt.id)
                     return { ...x, sortOrder: it.sortOrder ?? 0 };
                    return x;
                   })
                  );
                 }}
                 className="px-2 py-1 rounded-full border border-[#E8DDD4] bg-white/80 text-[11px] hover:shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                 title="Move up"
                >
                 ↑
                </button>
                <button
                 type="button"
                 disabled={adminItemsSaving || idx === list.length - 1}
                 onClick={() => {
                  if (idx === list.length - 1) return;
                  const nextIt = list[idx + 1];
                  setAdminItemsDraft((prev) =>
                   prev.map((x) => {
                    if (x.id === it.id)
                     return { ...x, sortOrder: nextIt.sortOrder ?? 0 };
                    if (x.id === nextIt.id)
                     return { ...x, sortOrder: it.sortOrder ?? 0 };
                    return x;
                   })
                  );
                 }}
                 className="px-2 py-1 rounded-full border border-[#E8DDD4] bg-white/80 text-[11px] hover:shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                 title="Move down"
                >
                 ↓
                </button>
               </div>
               <Switch
                checked={it.active}
                onCheckedChange={(next) => {
                 setAdminItemsDraft((prev) =>
                  prev.map((x) => (x.id === it.id ? { ...x, active: next } : x))
                 );
                }}
                label="Active"
               />
              </div>
             </div>
             <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
               <span className="text-xs text-[#716D64]">Color</span>
               <div className="flex items-center gap-2">
                <div
                 className="h-11 w-11 rounded-2xl border border-[#E8DDD4]"
                 style={{ backgroundColor: it.color || "#ffffff" }}
                 title={it.color || ""}
                />
                <input
                 value={it.color}
                 onChange={(e) => {
                  const v = e.target.value;
                  setAdminItemsDraft((prev) =>
                   prev.map((x) => (x.id === it.id ? { ...x, color: v } : x))
                  );
                 }}
                 placeholder="#rrggbb"
                 className="flex-1 rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
                />
                <button
                 type="button"
                 onClick={() => {
                  setAdminItemsDraft((prev) => {
                   const other = prev
                    .filter((x) => x.id !== it.id)
                    .map((x) => x.color ?? "");
                   const next = pickUnusedPastelRandom(other, {
                    avoid: it.color ?? "",
                   });
                   return prev.map((x) =>
                    x.id === it.id ? { ...x, color: next } : x
                   );
                  });
                 }}
                 className="px-3 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-xs hover:shadow-sm transition cursor-pointer"
                >
                 Random
                </button>
               </div>
               <div className="text-[11px] text-[#716D64]">
                Pastel color used in calendar backgrounds.
               </div>
              </label>
              <label className="grid gap-1">
               <span className="text-xs text-[#716D64]">Name</span>
               <input
                value={it.name}
                onChange={(e) => {
                 const v = e.target.value;
                 setAdminItemsDraft((prev) =>
                  prev.map((x) => (x.id === it.id ? { ...x, name: v } : x))
                 );
                }}
                className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
               />
              </label>
              <label className="grid gap-1">
               <span className="text-xs text-[#716D64]">Capacity</span>
               <input
                type="number"
                min={1}
                value={it.capacity}
                onChange={(e) => {
                 const v = Number(e.target.value);
                 setAdminItemsDraft((prev) =>
                  prev.map((x) => (x.id === it.id ? { ...x, capacity: v } : x))
                 );
                }}
                className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
               />
              </label>
              <label className="grid gap-1">
               <span className="text-xs text-[#716D64]">Linked key</span>
               <input
                value={it.exclusiveKey ?? ""}
                onChange={(e) => {
                 const v = e.target.value;
                 setAdminItemsDraft((prev) =>
                  prev.map((x) =>
                   x.id === it.id ? { ...x, exclusiveKey: v } : x
                  )
                 );
                }}
                className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
                placeholder="(optional)"
               />
               <div className="text-[11px] text-[#716D64]">
                Same key = mutually exclusive at the same date/time.
               </div>
              </label>
              <label className="grid gap-1 sm:col-span-2">
               <span className="text-xs text-[#716D64]">Description</span>
               <textarea
                rows={3}
                value={it.description}
                onChange={(e) => {
                 const v = e.target.value;
                 setAdminItemsDraft((prev) =>
                  prev.map((x) =>
                   x.id === it.id ? { ...x, description: v } : x
                  )
                 );
                }}
                className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
               />
              </label>

              <details className="sm:col-span-2 rounded-2xl border border-[#E8DDD4] bg-white/70 px-4 py-3">
               <summary className="cursor-pointer text-sm font-medium">
                Auto-cancel rule (min bookings)
               </summary>
               <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Switch
                 checked={Boolean(it.autoCancelEnabled)}
                 onCheckedChange={(next) => {
                  setAdminItemsDraft((prev) =>
                   prev.map((x) =>
                    x.id === it.id ? { ...x, autoCancelEnabled: next } : x
                   )
                  );
                 }}
                 label="Enabled"
                />
                <div className="text-[11px] text-[#716D64] sm:col-span-2">
                 If enabled, sessions will be automatically cancelled if the
                 number of bookings is below the minimum at the cutoff time
                 before start. A Twilio WhatsApp message will be sent.
                </div>
                <label className="grid gap-1">
                 <span className="text-xs text-[#716D64]">Minimum bookings</span>
                 <input
                  type="number"
                  min={1}
                  value={it.autoCancelMinBookings ?? 2}
                  onChange={(e) => {
                   const v = Number(e.target.value);
                   setAdminItemsDraft((prev) =>
                    prev.map((x) =>
                     x.id === it.id
                      ? {
                         ...x,
                         autoCancelMinBookings: Number.isFinite(v) ? v : 2,
                        }
                      : x
                    )
                   );
                  }}
                  className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
                 />
                </label>
                <label className="grid gap-1">
                 <span className="text-xs text-[#716D64]">
                  Cutoff (hours before start)
                 </span>
                 <input
                  type="number"
                  min={1}
                  value={it.autoCancelCutoffHours ?? 3}
                  onChange={(e) => {
                   const v = Number(e.target.value);
                   setAdminItemsDraft((prev) =>
                    prev.map((x) =>
                     x.id === it.id
                      ? {
                         ...x,
                         autoCancelCutoffHours: Number.isFinite(v) ? v : 3,
                        }
                      : x
                    )
                   );
                  }}
                  className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
                 />
                </label>
               </div>
              </details>
             </div>
            </div>
           ))}
          </div>
         )}
        </div>

        <div className="sticky bottom-4 mt-2">
         <div className="rounded-3xl border border-[#E8DDD4] bg-white/80 backdrop-blur px-5 py-4 shadow-sm flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-[#716D64]">
           {hasAdminItemsChanges ? "Unsaved changes" : "All changes saved"}
          </div>
          <div className="flex items-center gap-2">
           <button
            type="button"
            onClick={() => setAdminItemsDraft(adminItems)}
            disabled={
             adminItemsLoading || adminItemsSaving || !hasAdminItemsChanges
            }
            className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white text-sm hover:shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
           >
            Reset
           </button>
           <button
            type="button"
            onClick={saveAdminItemsDraft}
            disabled={
             adminItemsLoading || adminItemsSaving || !hasAdminItemsChanges
            }
            className="px-4 py-2 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
           >
            {adminItemsSaving ? "Saving…" : "Save changes"}
           </button>
          </div>
         </div>
        </div>
       </div>
      )}
     </section>
    ) : tab === "calendar" ? (
     <AdminCalendarView />
    ) : tab === "settings" ? (
     <section className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
      <h2 className="font-serif text-2xl font-semibold">Booking rules</h2>
      <div className="text-xs text-[#716D64] mt-1">
       Applied to public booking availability and booking creation.
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
       <label className="grid gap-1">
        <span className="text-xs text-[#716D64]">Minimum notice (hours)</span>
        <input
         type="number"
         min={0}
         value={minNoticeHours}
         onChange={(e) => setMinNoticeHours(Number(e.target.value))}
         className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
        />
        <div className="text-[11px] text-[#716D64]">
         Example: 24 means users must book at least 24 hours before session
         start.
        </div>
       </label>

       <label className="grid gap-1">
        <span className="text-xs text-[#716D64]">Max days ahead</span>
        <input
         type="number"
         min={1}
         value={maxDaysAhead}
         onChange={(e) => setMaxDaysAhead(Number(e.target.value))}
         className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
        />
        <div className="text-[11px] text-[#716D64]">
         Users can only book slots up to this many days in the future.
        </div>
       </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
       <button
        onClick={saveSettings}
        disabled={savingSettings}
        className="px-6 py-3 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 transition disabled:opacity-50"
       >
        {savingSettings ? "Saving…" : "Save rules"}
       </button>
       {saveSettingsMsg ? (
        <div className="text-sm text-[#716D64]">{saveSettingsMsg}</div>
       ) : null}
      </div>
     </section>
    ) : (
     <AdminBookingsView />
    )}
   </main>
  </div>
 );
}
