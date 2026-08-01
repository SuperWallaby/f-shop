import { DateTime } from "luxon";
import type { WithId } from "mongodb";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import type { CashTransactionDb } from "@/lib/db";

export function serializeCashTransaction(doc: WithId<CashTransactionDb>) {
  const occurredAt =
    doc.occurredAt instanceof Date
      ? doc.occurredAt
      : new Date(doc.occurredAt);
  const dt = DateTime.fromJSDate(occurredAt, { zone: BUSINESS_TIME_ZONE });
  return {
    id: doc._id.toHexString(),
    kind: doc.kind,
    occurredAt: occurredAt.toISOString(),
    occurredAtDateKey: dt.isValid ? dt.toFormat("yyyy-MM-dd") : "",
    amountRm: doc.amountRm,
    currency: doc.currency,
    category: doc.category,
    description: doc.description,
    note: doc.note ?? "",
    status: doc.status,
    voidedAt: doc.voidedAt ? doc.voidedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}

export type SerializedCashTransaction = ReturnType<
  typeof serializeCashTransaction
>;

export const CASH_INCOME_CATEGORIES = [
  "Misc income",
  "Workshop",
  "Refund received",
  "Other",
] as const;

export const CASH_EXPENSE_CATEGORIES = [
  "Rent",
  "Utilities",
  "Electricity & water",
  "Utility bills",
  "Transportation",
  "Food",
  "Equipment",
  "Stocks",
  "Supplies",
  "Salary",
  "Marketing",
  "Other",
] as const;
