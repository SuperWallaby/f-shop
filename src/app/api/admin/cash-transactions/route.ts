import { NextRequest } from "next/server";
import { DateTime } from "luxon";
import { getCollections, type CashTransactionDb } from "@/lib/db";
import {
  adminCashTxnCreateSchema,
  adminCashTxnListQuerySchema,
} from "@/lib/schemas";
import { serializeCashTransaction } from "@/lib/cashTransactions";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { requireAdmin } from "../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../_utils/http";

function parseOccurredAt(raw: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const dt = DateTime.fromISO(raw, { zone: BUSINESS_TIME_ZONE }).startOf(
      "day",
    );
    return dt.isValid ? dt.toJSDate() : null;
  }
  const dt = DateTime.fromISO(raw, { zone: BUSINESS_TIME_ZONE });
  return dt.isValid ? dt.toJSDate() : null;
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const parsed = adminCashTxnListQuerySchema.safeParse({
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      kind: searchParams.get("kind") ?? undefined,
    });
    if (!parsed.success) {
      return jsonError("Invalid query", 400, parsed.error.flatten());
    }

    const filter: Record<string, unknown> = {};
    if (parsed.data.status && parsed.data.status !== "all") {
      filter.status = parsed.data.status;
    }
    if (parsed.data.kind && parsed.data.kind !== "all") {
      filter.kind = parsed.data.kind;
    }
    if (parsed.data.from || parsed.data.to) {
      const range: Record<string, Date> = {};
      if (parsed.data.from) {
        const from = DateTime.fromISO(parsed.data.from, {
          zone: BUSINESS_TIME_ZONE,
        }).startOf("day");
        if (from.isValid) range.$gte = from.toJSDate();
      }
      if (parsed.data.to) {
        const to = DateTime.fromISO(parsed.data.to, {
          zone: BUSINESS_TIME_ZONE,
        }).endOf("day");
        if (to.isValid) range.$lte = to.toJSDate();
      }
      if (Object.keys(range).length) filter.occurredAt = range;
    }

    const { cashTransactions } = await getCollections();
    const docs = await cashTransactions
      .find(filter)
      .sort({ occurredAt: -1, createdAt: -1 })
      .limit(300)
      .toArray();
    const totalsFilter = { ...filter, status: "recorded" };
    const [totals] = await cashTransactions
      .aggregate<{
        otherIncome: number;
        otherExpense: number;
      }>([
        { $match: totalsFilter },
        {
          $group: {
            _id: null,
            otherIncome: {
              $sum: {
                $cond: [{ $eq: ["$kind", "income"] }, "$amountRm", 0],
              },
            },
            otherExpense: {
              $sum: {
                $cond: [{ $eq: ["$kind", "expense"] }, "$amountRm", 0],
              },
            },
          },
        },
        { $project: { _id: 0, otherIncome: 1, otherExpense: 1 } },
      ])
      .toArray();
    const otherIncome = totals?.otherIncome ?? 0;
    const otherExpense = totals?.otherExpense ?? 0;
    const categoryRows = await cashTransactions
      .aggregate<{
        kind: "income" | "expense";
        label: string;
        amount: number;
        count: number;
      }>([
        { $match: totalsFilter },
        {
          $group: {
            _id: { kind: "$kind", category: "$category" },
            amount: { $sum: "$amountRm" },
            count: { $sum: 1 },
          },
        },
        { $sort: { amount: -1 } },
        {
          $project: {
            _id: 0,
            kind: "$_id.kind",
            label: "$_id.category",
            amount: 1,
            count: 1,
          },
        },
      ])
      .toArray();

    return jsonOk({
      transactions: docs.map(serializeCashTransaction),
      totals: {
        otherIncome,
        otherExpense,
        otherNet: otherIncome - otherExpense,
      },
      byOtherIncome: categoryRows
        .filter((row) => row.kind === "income")
        .slice(0, 12),
      outcomeRanking: categoryRows
        .filter((row) => row.kind === "expense")
        .slice(0, 12),
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const body = await req.json().catch(() => null);
    const parsed = adminCashTxnCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }
    const d = parsed.data;
    const occurredAt = parseOccurredAt(d.occurredAt);
    if (!occurredAt) return jsonError("Invalid occurredAt", 400);

    const { cashTransactions } = await getCollections();
    const now = new Date();
    const doc: CashTransactionDb = {
      kind: d.kind,
      occurredAt,
      amountRm: d.amountRm,
      currency: "MYR",
      category: d.category.trim(),
      description: d.description.trim(),
      note: d.note?.trim() || undefined,
      status: "recorded",
      createdAt: now,
      updatedAt: now,
    };
    const ins = await cashTransactions.insertOne(doc);
    const saved = await cashTransactions.findOne({ _id: ins.insertedId });
    if (!saved) return jsonError("Create failed", 500);
    return jsonOk({ transaction: serializeCashTransaction(saved) });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
