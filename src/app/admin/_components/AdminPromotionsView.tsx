"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Pill } from "./Pill";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";

type DiscountType = "fixed" | "percent" | "other";

type PromotionRow = {
  id: string;
  name: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  discountLabel: string;
  badgeLabel: string;
  planIds: string[];
  imageUrl: string;
  showAsModal: boolean;
  modalLink: string;
  active: boolean;
  sortOrder: number;
};

type PlanOption = { id: string; title: string; active: boolean };

const emptyForm = {
  name: "",
  description: "",
  discountType: "fixed" as DiscountType,
  discountValue: 0,
  discountLabel: "",
  badgeLabel: "",
  planIds: [] as string[],
  imageUrl: "",
  showAsModal: false,
  modalLink: "",
  active: true,
  sortOrder: 100,
};

function discountCell(row: PromotionRow) {
  if (row.discountType === "percent") return `${row.discountValue}% off`;
  if (row.discountType === "fixed") return `RM ${row.discountValue} off`;
  return row.discountLabel || "Custom";
}

export function AdminPromotionsView() {
  const [rows, setRows] = useState<PromotionRow[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [promoRes, plansRes] = await Promise.all([
        fetch("/api/admin/promotions", { cache: "no-store" }),
        fetch("/api/admin/plans", { cache: "no-store" }),
      ]);
      const promoJson = await promoRes.json();
      const plansJson = await plansRes.json();
      if (!promoRes.ok || !promoJson?.ok) {
        throw new Error(promoJson?.error?.message ?? "Failed to load promotions");
      }
      setRows(promoJson.data.promotions ?? []);
      if (plansJson?.ok) {
        setPlans(
          (plansJson.data.plans ?? []).map(
            (p: { id: string; title: string; active: boolean }) => ({
              id: p.id,
              title: p.title,
              active: p.active,
            }),
          ),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (form.discountType === "other" && !form.discountLabel.trim()) {
      setError("Enter a label for “Something else” (e.g. Buy 1 Get 1)");
      return;
    }
    if (form.showAsModal && !form.imageUrl.trim()) {
      setError("Upload or paste an image URL to show as modal");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = editId
        ? `/api/admin/promotions/${editId}`
        : "/api/admin/promotions";
      const res = await fetch(url, {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          discountType: form.discountType,
          discountValue:
            form.discountType === "other" ? 0 : Number(form.discountValue) || 0,
          discountLabel:
            form.discountType === "other"
              ? form.discountLabel.trim()
              : form.discountLabel.trim() || undefined,
          badgeLabel: form.badgeLabel.trim() || undefined,
          planIds: form.planIds,
          imageUrl: form.imageUrl.trim() || "",
          showAsModal: form.showAsModal,
          modalLink: form.modalLink.trim() || "",
          active: form.active,
          sortOrder: Number(form.sortOrder) || 100,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Save failed");
      }
      setForm(emptyForm);
      setEditId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: PromotionRow) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/promotions/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !row.active }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Update failed");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  function startEdit(row: PromotionRow) {
    setEditId(row.id);
    setForm({
      name: row.name,
      description: row.description,
      discountType: row.discountType,
      discountValue: row.discountValue,
      discountLabel: row.discountLabel,
      badgeLabel: row.badgeLabel,
      planIds: row.planIds ?? [],
      imageUrl: row.imageUrl,
      showAsModal: row.showAsModal,
      modalLink: row.modalLink,
      active: row.active,
      sortOrder: row.sortOrder,
    });
  }

  function togglePlan(planId: string) {
    setForm((f) => ({
      ...f,
      planIds: f.planIds.includes(planId)
        ? f.planIds.filter((id) => id !== planId)
        : [...f.planIds, planId],
    }));
  }

  function onPickImage(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    if (file.size > 900_000) {
      setError("Image too large (max ~900KB). Compress or use a URL.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, imageUrl: String(reader.result ?? "") }));
      setError(null);
    };
    reader.onerror = () => setError("Failed to read image");
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-6">
      <section className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
        <h2 className="font-serif text-xl font-semibold">
          {editId ? "Edit promotion" : "New promotion"}
        </h2>
        <p className="mt-1 text-sm text-[#716D64]">
          Link plans to show a discount badge on package cards. Optional modal
          popup uses the promo image on the site.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-xs text-[#716D64]">Name</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
              placeholder="Ramadan special"
            />
          </label>
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-xs text-[#716D64]">Description</span>
            <input
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
              placeholder="Optional notes"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">Discount type</span>
            <select
              value={form.discountType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  discountType: e.target.value as DiscountType,
                }))
              }
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
            >
              <option value="fixed">Fixed RM off</option>
              <option value="percent">Percent off</option>
              <option value="other">Something else</option>
            </select>
          </label>
          {form.discountType === "other" ? (
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">Offer label</span>
              <input
                value={form.discountLabel}
                onChange={(e) =>
                  setForm((f) => ({ ...f, discountLabel: e.target.value }))
                }
                className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
                placeholder="Buy 1 Get 1 / Free reformer add-on"
              />
            </label>
          ) : (
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">
                Value ({form.discountType === "percent" ? "%" : "RM"})
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.discountValue}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    discountValue: Number(e.target.value),
                  }))
                }
                className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
              />
            </label>
          )}
          <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">Badge label (optional)</span>
            <input
              value={form.badgeLabel}
              onChange={(e) =>
                setForm((f) => ({ ...f, badgeLabel: e.target.value }))
              }
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
              placeholder="Defaults to name"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">Sort order</span>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) =>
                setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))
              }
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
            />
          </label>

          <div className="sm:col-span-2 grid gap-2">
            <span className="text-xs text-[#716D64]">Target plans</span>
            <div className="rounded-2xl border border-[#E8DDD4] bg-white px-3 py-3 max-h-48 overflow-y-auto space-y-2">
              {plans.length === 0 ? (
                <div className="text-sm text-[#716D64]">No plans found.</div>
              ) : (
                plans.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.planIds.includes(p.id)}
                      onChange={() => togglePlan(p.id)}
                      className="rounded border-[#E8DDD4]"
                    />
                    <span className={cn(!p.active && "text-[#716D64]")}>
                      {p.title}
                      {!p.active ? " (inactive)" : ""}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="sm:col-span-2 grid gap-2">
            <span className="text-xs text-[#716D64]">Photo</span>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer rounded-full border border-[#E8DDD4] bg-white px-4 py-2 text-sm hover:shadow-sm">
                Upload image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                />
              </label>
              {form.imageUrl ? (
                <>
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    className="text-sm underline text-[#716D64] hover:text-[#444444] cursor-pointer"
                  >
                    Preview modal
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                    className="text-sm underline text-[#716D64] hover:text-[#444444] cursor-pointer"
                  >
                    Remove
                  </button>
                </>
              ) : null}
            </div>
            <input
              value={form.imageUrl.startsWith("data:") ? "" : form.imageUrl}
              onChange={(e) =>
                setForm((f) => ({ ...f, imageUrl: e.target.value }))
              }
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
              placeholder="Or paste image URL"
            />
            {form.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.imageUrl}
                alt="Promo preview"
                className="mt-1 max-h-40 w-auto rounded-2xl border border-[#E8DDD4] object-contain bg-white"
              />
            ) : null}
          </div>

          <label className="grid gap-1 sm:col-span-2">
            <span className="text-xs text-[#716D64]">Modal link (optional)</span>
            <input
              value={form.modalLink}
              onChange={(e) =>
                setForm((f) => ({ ...f, modalLink: e.target.value }))
              }
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
              placeholder="https://…"
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm self-end pb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.showAsModal}
              onChange={(e) =>
                setForm((f) => ({ ...f, showAsModal: e.target.checked }))
              }
              className="rounded border-[#E8DDD4]"
            />
            Show as site modal
          </label>
          <label className="inline-flex items-center gap-2 text-sm self-end pb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) =>
                setForm((f) => ({ ...f, active: e.target.checked }))
              }
              className="rounded border-[#E8DDD4]"
            />
            Active
          </label>
        </div>
        {error ? <div className="mt-3 text-sm text-red-700">{error}</div> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="rounded-full bg-[#DFD1C9] px-5 py-2.5 text-sm font-medium hover:brightness-95 disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving…" : editId ? "Update" : "Create"}
          </button>
          {editId ? (
            <button
              type="button"
              onClick={() => {
                setEditId(null);
                setForm(emptyForm);
              }}
              className="rounded-full border border-[#E8DDD4] bg-white px-5 py-2.5 text-sm cursor-pointer"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </section>

      <section className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm overflow-x-auto">
        <h2 className="font-serif text-xl font-semibold mb-4">All promotions</h2>
        {loading ? (
          <div className="text-sm text-[#716D64]">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-[#716D64]">No promotions yet.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs text-[#716D64] border-b border-[#E8DDD4]">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Discount</th>
                <th className="py-2 pr-3 font-medium">Plans</th>
                <th className="py-2 pr-3 font-medium">Modal</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[#E8DDD4]/60">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      {row.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.imageUrl}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover border border-[#E8DDD4]"
                        />
                      ) : null}
                      <div>
                        <div className="font-medium text-[#444444]">
                          {row.name}
                        </div>
                        {row.description ? (
                          <div className="text-xs text-[#716D64] mt-0.5">
                            {row.description}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-3">{discountCell(row)}</td>
                  <td className="py-3 pr-3">
                    {(row.planIds ?? []).length
                      ? `${row.planIds.length} plan(s)`
                      : "—"}
                  </td>
                  <td className="py-3 pr-3">
                    {row.showAsModal ? "Yes" : "—"}
                  </td>
                  <td className="py-3 pr-3">
                    <Pill
                      label={row.active ? "Active" : "Off"}
                      tone={row.active ? "good" : "muted"}
                    />
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="text-xs underline text-[#716D64] hover:text-[#444444] cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleActive(row)}
                        className="text-xs underline text-[#716D64] hover:text-[#444444] cursor-pointer"
                      >
                        {row.active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {previewOpen && form.imageUrl ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/75"
            aria-label="Close preview"
            onClick={() => setPreviewOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md">
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute -top-11 right-0 rounded-full p-1 text-white/90 hover:bg-white/10"
              aria-label="Close"
            >
              <XMarkIcon className="h-8 w-8" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={form.imageUrl}
              alt="Modal preview"
              className="w-full rounded-2xl shadow-2xl object-contain max-h-[85vh] bg-white"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
