import { DateTime } from "luxon";
import type { ObjectId } from "mongodb";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import type { SaleDb } from "@/lib/db";

/** Studio details as printed on sales receipts (matches recipt.png / reciptexample.pdf). */
export const STUDIO_RECEIPT = {
  name: "Fasea Pilates Studio",
  legalName: "FASEA PILATES STUDIO",
  addressLines: [
    "Pt 30713, Jalan Lapangan Terbang,",
    "Kampung Wakaf Baru, 21300 Kuala",
    "Terengganu, Terengganu",
  ],
  registrationNo: "SA0635576-P",
  telDisplay: "014-5403560",
  bankName: "MAYBANK BANK",
  bankAccount: "5630 1103 7772",
  defaultPaymentMethod: "Online transfer",
} as const;

export function formatReceiptMoney(n: number): string {
  return `RM ${n.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatReceiptDate(isoOrDate: string | Date): string {
  const dt =
    typeof isoOrDate === "string"
      ? DateTime.fromISO(isoOrDate, { zone: BUSINESS_TIME_ZONE })
      : DateTime.fromJSDate(isoOrDate, { zone: BUSINESS_TIME_ZONE });
  if (!dt.isValid) return "—";
  return dt.toFormat("MMMM d, yyyy");
}

export function formatReceiptPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  // MY mobile: 01X-XXXXXXX or 01X-XXXXXXXX
  let local = digits;
  if (local.startsWith("60") && local.length >= 11) local = `0${local.slice(2)}`;
  if (local.length === 10 || local.length === 11) {
    return `${local.slice(0, 3)}-${local.slice(3)}`;
  }
  return raw.trim();
}

/** RCP2026-0609-002 style code from sold date + daily sequence. */
export function buildReceiptNo(soldAt: Date, sequence: number): string {
  const dt = DateTime.fromJSDate(soldAt, { zone: BUSINESS_TIME_ZONE });
  const seq = Math.max(1, sequence);
  return `RCP${dt.toFormat("yyyy")}-${dt.toFormat("MMdd")}-${String(seq).padStart(3, "0")}`;
}

/** Stable fallback when older sales have no stored receiptNo. */
export function fallbackReceiptNo(
  soldAt: Date,
  idHex: string,
): string {
  const dt = DateTime.fromJSDate(soldAt, { zone: BUSINESS_TIME_ZONE });
  const seq = (parseInt(idHex.slice(-4), 16) % 1000 || 1)
    .toString()
    .padStart(3, "0");
  return `RCP${dt.toFormat("yyyy")}-${dt.toFormat("MMdd")}-${seq}`;
}

export function resolveReceiptNo(
  doc: Pick<SaleDb, "soldAt" | "receiptNo"> & { _id?: ObjectId },
): string {
  if (doc.receiptNo?.trim()) return doc.receiptNo.trim();
  const id = doc._id?.toHexString() ?? "001";
  return fallbackReceiptNo(doc.soldAt, id);
}

export type ReceiptSaleView = {
  id: string;
  receiptNo: string;
  soldAt: string;
  clientName: string;
  clientEmail: string;
  clientWhatsapp: string;
  planTitle: string;
  itemName: string;
  classCount: number;
  listPriceRm: number;
  amountRm: number;
  status: "paid" | "refunded";
  paymentMethod: string;
  promotionName?: string;
};

export function receiptLineDescription(sale: ReceiptSaleView): {
  title: string;
  detail: string;
} {
  const title =
    sale.planTitle.trim() ||
    sale.itemName.trim() ||
    "Studio package";
  const sessionLabel = sale.itemName.trim() || "Sessions";
  const detail =
    sale.classCount > 0
      ? `${sale.classCount}x ${sessionLabel}`
      : sale.promotionName?.trim() || "";
  return { title, detail };
}

export function receiptDiscountRm(sale: ReceiptSaleView): number | null {
  const discount = sale.listPriceRm - sale.amountRm;
  if (discount > 0.009) return discount;
  return null;
}
