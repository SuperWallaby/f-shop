"use client";

import { useCallback, useEffect, useState } from "react";
import { Switch } from "@/components/Switch";

type AdminPlanRow = {
  id: string;
  code: string;
  title: string;
  cardTitle: string | null;
  category: string;
  classCount: number;
  priceRm: number;
  studentPriceRm: number | null;
  firstTimerPriceRm: number | null;
  listPriceRm: number | null;
  validityDays: number;
  active: boolean;
  hidden: boolean;
  sortOrder: number;
  detailLines: string[];
  priceNote: string | null;
  promotionActive: boolean;
  promotionDiscount: string | null;
  promotionLabel: string | null;
};

const emptyCreate = {
  title: "",
  cardTitle: "",
  category: "group_mat" as const,
  classCount: 1,
  priceRm: 0,
  studentPriceRm: "" as string | number,
  firstTimerPriceRm: "" as string | number,
  listPriceRm: "" as string | number,
  validityDays: 30,
  active: true,
  hidden: false,
  sortOrder: 1000,
  detailLinesText: "",
  priceNote: "",
  promotionActive: false,
  promotionDiscount: "",
  promotionLabel: "",
};

const DETAIL_LINES_PLACEHOLDER = `1 Month Validity
Non-shareable
Non-refundable`;

export function AdminPlansView() {
  const [plans, setPlans] = useState<AdminPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState(emptyCreate);
  const [createSaving, setCreateSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/plans", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? "Failed to load");
      setPlans((json.data.plans ?? []) as AdminPlanRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchPlan(id: string, body: Record<string, unknown>) {
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/plans/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? "Save failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  }

  async function submitCreate() {
    setCreateSaving(true);
    setError(null);
    const student =
      createDraft.studentPriceRm === "" || createDraft.studentPriceRm === undefined
        ? undefined
        : Number(createDraft.studentPriceRm);
    const firstTimer =
      createDraft.firstTimerPriceRm === "" ||
      createDraft.firstTimerPriceRm === undefined
        ? undefined
        : Number(createDraft.firstTimerPriceRm);
    const list =
      createDraft.listPriceRm === "" || createDraft.listPriceRm === undefined
        ? undefined
        : Number(createDraft.listPriceRm);
    const detailLines = createDraft.detailLinesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createDraft.title.trim(),
          cardTitle: createDraft.cardTitle.trim() || null,
          category: createDraft.category,
          classCount: createDraft.classCount,
          priceRm: createDraft.priceRm,
          studentPriceRm: student ?? null,
          firstTimerPriceRm: firstTimer ?? null,
          listPriceRm: list ?? null,
          validityDays: createDraft.validityDays,
          active: createDraft.active,
          hidden: createDraft.hidden,
          sortOrder: createDraft.sortOrder,
          detailLines: detailLines.length ? detailLines : undefined,
          priceNote: createDraft.priceNote.trim() || null,
          promotionActive: createDraft.promotionActive,
          promotionDiscount: createDraft.promotionActive
            ? createDraft.promotionDiscount.trim() || null
            : null,
          promotionLabel: createDraft.promotionActive
            ? createDraft.promotionLabel.trim() || null
            : null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? "Create failed");
      setCreateDraft(emptyCreate);
      setCreateOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreateSaving(false);
    }
  }

  return (
    <section className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold">Plans</h2>
        <p className="text-xs text-[#716D64] mt-1">
          Packages shown on the website, booking, and WhatsApp checkout. Use{" "}
          <span className="font-medium text-[#444444]">Hidden</span> to keep a plan available in
          admin/sales while hiding it from customers.{" "}
          <span className="font-medium text-[#444444]">In-group title</span> is the short line under
          each category (e.g. Single Class); full title is still used for WhatsApp messages and
          orders. New codes are inserted once from defaults; edits here are kept.
        </p>
      </div>

      {error ? <div className="text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="text-sm text-[#716D64]">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#E8DDD4]">
          <table className="min-w-[800px] w-full text-sm">
            <thead className="bg-[#FAF8F6] text-left text-xs text-[#716D64] uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Hidden</th>
                <th className="px-3 py-2">Sort</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Full title</th>
                <th className="px-3 py-2 max-w-[140px]">In-group</th>
                <th className="px-3 py-2">Cat</th>
                <th className="px-3 py-2">Credits</th>
                <th className="px-3 py-2">RM</th>
                <th className="px-3 py-2">Days</th>
                <th className="px-3 py-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <PlanEditRow
                  key={p.id}
                  plan={p}
                  saving={savingId === p.id}
                  onPatch={(body) => patchPlan(p.id, body)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setCreateOpen((o) => !o)}
          className="px-4 py-2 rounded-full border border-[#E8DDD4] bg-white text-sm hover:shadow-sm transition"
        >
          {createOpen ? "Close new plan" : "Add plan"}
        </button>
        {createOpen ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 max-w-3xl">
            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs text-[#716D64]">
                Full title (WhatsApp, orders — e.g. Group Mat - 4 Classes)
              </span>
              <input
                value={createDraft.title}
                onChange={(e) => setCreateDraft((d) => ({ ...d, title: e.target.value }))}
                className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
              />
              <span className="text-[11px] text-[#716D64]">
                Code is generated automatically from the title.
              </span>
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">
                In-group title (booking & homepage cards — e.g. 4 Classes)
              </span>
              <input
                value={createDraft.cardTitle}
                onChange={(e) => setCreateDraft((d) => ({ ...d, cardTitle: e.target.value }))}
                className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
                placeholder="Single Class"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">Category</span>
              <select
                value={createDraft.category}
                onChange={(e) =>
                  setCreateDraft((d) => ({
                    ...d,
                    category: e.target.value as (typeof emptyCreate)["category"],
                  }))
                }
                className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
              >
                <option value="group_mat">group_mat</option>
                <option value="mat_private">mat_private</option>
                <option value="reformer_private">reformer_private</option>
                <option value="pre_post_reformer">pre_post_reformer</option>
                <option value="duet">duet</option>
                <option value="reformer_group">reformer_group</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">Class count</span>
              <input
                type="number"
                min={1}
                value={createDraft.classCount}
                onChange={(e) =>
                  setCreateDraft((d) => ({ ...d, classCount: Number(e.target.value) }))
                }
                className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">Price RM</span>
              <input
                type="number"
                min={0}
                value={createDraft.priceRm}
                onChange={(e) =>
                  setCreateDraft((d) => ({ ...d, priceRm: Number(e.target.value) }))
                }
                className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">Student price RM (optional)</span>
              <input
                type="number"
                min={0}
                value={createDraft.studentPriceRm}
                onChange={(e) =>
                  setCreateDraft((d) => ({ ...d, studentPriceRm: e.target.value }))
                }
                className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
                placeholder="empty = none"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">
                First-timer price RM (optional)
              </span>
              <input
                type="number"
                min={0}
                value={createDraft.firstTimerPriceRm}
                onChange={(e) =>
                  setCreateDraft((d) => ({
                    ...d,
                    firstTimerPriceRm: e.target.value,
                  }))
                }
                className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
                placeholder="empty = none"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">List price RM (strike, optional)</span>
              <input
                type="number"
                min={0}
                value={createDraft.listPriceRm}
                onChange={(e) => setCreateDraft((d) => ({ ...d, listPriceRm: e.target.value }))}
                className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">Validity days</span>
              <input
                type="number"
                min={1}
                value={createDraft.validityDays}
                onChange={(e) =>
                  setCreateDraft((d) => ({ ...d, validityDays: Number(e.target.value) }))
                }
                className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">Sort order</span>
              <input
                type="number"
                min={0}
                value={createDraft.sortOrder}
                onChange={(e) =>
                  setCreateDraft((d) => ({ ...d, sortOrder: Number(e.target.value) }))
                }
                className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
              />
              <span className="text-[11px] text-[#716D64]">
                Lower numbers appear first within a category (e.g. 10, 20, 30).
              </span>
            </label>
            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs text-[#716D64]">Detail lines (one per line)</span>
              <textarea
                value={createDraft.detailLinesText}
                onChange={(e) =>
                  setCreateDraft((d) => ({ ...d, detailLinesText: e.target.value }))
                }
                rows={4}
                placeholder={DETAIL_LINES_PLACEHOLDER}
                className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm font-mono"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-[#716D64]">Price note</span>
              <input
                value={createDraft.priceNote}
                onChange={(e) => setCreateDraft((d) => ({ ...d, priceNote: e.target.value }))}
                className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
                placeholder="/ per head"
              />
            </label>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                checked={createDraft.promotionActive}
                onCheckedChange={(v) =>
                  setCreateDraft((d) => ({ ...d, promotionActive: Boolean(v) }))
                }
              />
              <span className="text-xs text-[#716D64]">Promotion badge</span>
            </div>
            {createDraft.promotionActive ? (
              <>
                <label className="grid gap-1">
                  <span className="text-xs text-[#716D64]">Promo discount text</span>
                  <input
                    value={createDraft.promotionDiscount}
                    onChange={(e) =>
                      setCreateDraft((d) => ({ ...d, promotionDiscount: e.target.value }))
                    }
                    className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
                    placeholder="e.g. 20% off"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-[#716D64]">Promo label</span>
                  <input
                    value={createDraft.promotionLabel}
                    onChange={(e) =>
                      setCreateDraft((d) => ({ ...d, promotionLabel: e.target.value }))
                    }
                    className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
                    placeholder="e.g. Limited offer"
                  />
                </label>
              </>
            ) : null}
            <div className="flex items-center gap-2">
              <Switch
                checked={createDraft.active}
                onCheckedChange={(v) => setCreateDraft((d) => ({ ...d, active: Boolean(v) }))}
              />
              <span className="text-xs text-[#716D64]">Active</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={createDraft.hidden}
                onCheckedChange={(v) => setCreateDraft((d) => ({ ...d, hidden: Boolean(v) }))}
              />
              <span className="text-xs text-[#716D64]">Hidden from customers</span>
            </div>
            <button
              type="button"
              disabled={createSaving || !createDraft.title.trim()}
              onClick={() => void submitCreate()}
              className="sm:col-span-2 px-6 py-3 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 disabled:opacity-50"
            >
              {createSaving ? "Creating…" : "Create plan"}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PlanEditRow({
  plan,
  saving,
  onPatch,
}: {
  plan: AdminPlanRow;
  saving: boolean;
  onPatch: (body: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(plan.title);
  const [cardTitle, setCardTitle] = useState(plan.cardTitle ?? "");
  const [category, setCategory] = useState(plan.category);
  const [classCount, setClassCount] = useState(plan.classCount);
  const [priceRm, setPriceRm] = useState(plan.priceRm);
  const [studentRm, setStudentRm] = useState(
    plan.studentPriceRm != null ? String(plan.studentPriceRm) : "",
  );
  const [firstTimerRm, setFirstTimerRm] = useState(
    plan.firstTimerPriceRm != null ? String(plan.firstTimerPriceRm) : "",
  );
  const [listRm, setListRm] = useState(plan.listPriceRm != null ? String(plan.listPriceRm) : "");
  const [validityDays, setValidityDays] = useState(plan.validityDays);
  const [sortOrder, setSortOrder] = useState(plan.sortOrder);
  const [detailText, setDetailText] = useState(plan.detailLines.join("\n"));
  const [priceNote, setPriceNote] = useState(plan.priceNote ?? "");
  const [promoActive, setPromoActive] = useState(plan.promotionActive);
  const [promoDiscount, setPromoDiscount] = useState(plan.promotionDiscount ?? "");
  const [promoLabel, setPromoLabel] = useState(plan.promotionLabel ?? "");

  useEffect(() => {
    setTitle(plan.title);
    setCardTitle(plan.cardTitle ?? "");
    setCategory(plan.category);
    setClassCount(plan.classCount);
    setPriceRm(plan.priceRm);
    setStudentRm(plan.studentPriceRm != null ? String(plan.studentPriceRm) : "");
    setFirstTimerRm(
      plan.firstTimerPriceRm != null ? String(plan.firstTimerPriceRm) : "",
    );
    setListRm(plan.listPriceRm != null ? String(plan.listPriceRm) : "");
    setValidityDays(plan.validityDays);
    setSortOrder(plan.sortOrder);
    setDetailText(plan.detailLines.join("\n"));
    setPriceNote(plan.priceNote ?? "");
    setPromoActive(plan.promotionActive);
    setPromoDiscount(plan.promotionDiscount ?? "");
    setPromoLabel(plan.promotionLabel ?? "");
  }, [plan]);

  function save() {
    const detailLines = detailText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    onPatch({
      title: title.trim(),
      cardTitle: cardTitle.trim() || null,
      category,
      classCount,
      priceRm,
      studentPriceRm: studentRm === "" ? null : Number(studentRm),
      firstTimerPriceRm: firstTimerRm === "" ? null : Number(firstTimerRm),
      listPriceRm: listRm === "" ? null : Number(listRm),
      validityDays,
      sortOrder,
      detailLines,
      priceNote: priceNote.trim() || null,
      promotionActive: promoActive,
      promotionDiscount: promoActive ? promoDiscount.trim() || null : null,
      promotionLabel: promoActive ? promoLabel.trim() || null : null,
    });
  }

  return (
    <>
      <tr className="border-t border-[#E8DDD4] align-middle">
        <td className="px-3 py-2">
          <Switch
            checked={plan.active}
            onCheckedChange={(v) => onPatch({ active: Boolean(v) })}
            disabled={saving}
          />
        </td>
        <td className="px-3 py-2">
          <Switch
            checked={plan.hidden}
            onCheckedChange={(v) => onPatch({ hidden: Boolean(v) })}
            disabled={saving}
          />
        </td>
        <td className="px-3 py-2 font-mono text-xs">{plan.sortOrder}</td>
        <td className="px-3 py-2 font-mono text-xs">{plan.code}</td>
        <td className="px-3 py-2 max-w-[200px]">
          <div className="font-medium truncate" title={plan.title}>
            {plan.title}
          </div>
        </td>
        <td className="px-3 py-2 max-w-[140px] text-xs text-[#716D64]">
          <div className="truncate" title={plan.cardTitle ?? ""}>
            {plan.cardTitle?.trim() ? plan.cardTitle : "—"}
          </div>
        </td>
        <td className="px-3 py-2 text-xs">{plan.category}</td>
        <td className="px-3 py-2">{plan.classCount}</td>
        <td className="px-3 py-2">{plan.priceRm}</td>
        <td className="px-3 py-2">{plan.validityDays}</td>
        <td className="px-3 py-2">
          <button
            type="button"
            className="text-xs text-[#A66A4A] underline"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Close" : "Edit"}
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="bg-[#FAF8F6]/80">
          <td colSpan={11} className="px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-2 max-w-3xl">
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs text-[#716D64]">
                  Full title (WhatsApp, orders)
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">
                  In-group title (booking & homepage)
                </span>
                <input
                  value={cardTitle}
                  onChange={(e) => setCardTitle(e.target.value)}
                  className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
                  placeholder="e.g. Single Class"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
                >
                  <option value="group_mat">group_mat</option>
                  <option value="mat_private">mat_private</option>
                  <option value="reformer_private">reformer_private</option>
                  <option value="pre_post_reformer">pre_post_reformer</option>
                  <option value="duet">duet</option>
                  <option value="reformer_group">reformer_group</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">Credits</span>
                <input
                  type="number"
                  min={1}
                  value={classCount}
                  onChange={(e) => setClassCount(Number(e.target.value))}
                  className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">Price RM</span>
                <input
                  type="number"
                  min={0}
                  value={priceRm}
                  onChange={(e) => setPriceRm(Number(e.target.value))}
                  className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">Student RM</span>
                <input
                  type="number"
                  min={0}
                  value={studentRm}
                  onChange={(e) => setStudentRm(e.target.value)}
                  className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">First-timer RM</span>
                <input
                  type="number"
                  min={0}
                  value={firstTimerRm}
                  onChange={(e) => setFirstTimerRm(e.target.value)}
                  className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">List RM (strike)</span>
                <input
                  type="number"
                  min={0}
                  value={listRm}
                  onChange={(e) => setListRm(e.target.value)}
                  className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">Validity days</span>
                <input
                  type="number"
                  min={1}
                  value={validityDays}
                  onChange={(e) => setValidityDays(Number(e.target.value))}
                  className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">Sort order</span>
                <input
                  type="number"
                  min={0}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
                />
                <span className="text-[11px] text-[#716D64]">
                  Lower numbers appear first within a category (e.g. 10, 20, 30).
                </span>
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs text-[#716D64]">Detail lines (one per line)</span>
                <textarea
                  value={detailText}
                  onChange={(e) => setDetailText(e.target.value)}
                  rows={4}
                  placeholder={DETAIL_LINES_PLACEHOLDER}
                  className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm font-mono"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-[#716D64]">Price note</span>
                <input
                  value={priceNote}
                  onChange={(e) => setPriceNote(e.target.value)}
                  className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
                  placeholder="/ per head"
                />
              </label>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={promoActive} onCheckedChange={(v) => setPromoActive(Boolean(v))} />
                <span className="text-xs text-[#716D64]">Promo badge</span>
              </div>
              {promoActive ? (
                <>
                  <label className="grid gap-1">
                    <span className="text-xs text-[#716D64]">Promo discount</span>
                    <input
                      value={promoDiscount}
                      onChange={(e) => setPromoDiscount(e.target.value)}
                      className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
                      placeholder="e.g. 20% off"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-[#716D64]">Promo label</span>
                    <input
                      value={promoLabel}
                      onChange={(e) => setPromoLabel(e.target.value)}
                      className="rounded-xl border border-[#E8DDD4] px-3 py-2 text-sm"
                      placeholder="e.g. Limited offer"
                    />
                  </label>
                </>
              ) : null}
              <button
                type="button"
                disabled={saving || !title.trim()}
                onClick={save}
                className="sm:col-span-2 px-6 py-2 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 disabled:opacity-50 w-fit"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
