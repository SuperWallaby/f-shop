"use client";

import { useCallback, useRef, useState } from "react";
import { getFontEmbedCSS, toPng } from "html-to-image";
import {
  formatReceiptDate,
  formatReceiptMoney,
  formatReceiptPhone,
  receiptDiscountRm,
  receiptLineDescription,
  receiptLineQty,
  STUDIO_RECEIPT,
  type ReceiptSaleView,
} from "@/lib/studioReceipt";

function FaseaReceiptLogo({ className }: { className?: string }) {
  const src =
    typeof window !== "undefined"
      ? `${window.location.origin}/logo.png`
      : "/logo.png";
  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Faséa Pilates"
        className="h-20 w-auto object-contain"
      />
    </div>
  );
}

async function waitForReceiptImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );
}

async function waitForReceiptFonts() {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await document.fonts.ready;
  } catch {
    // Ignore font readiness errors and continue with fallback fonts.
  }
}

function triggerPngDownload(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function captureReceiptPng(node: HTMLElement): Promise<string> {
  await waitForReceiptImages(node);
  await waitForReceiptFonts();
  // Give layout/fonts one paint before rasterizing.
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => resolve()),
  );
  const fontEmbedCSS = await getFontEmbedCSS(node);
  return toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    fontEmbedCSS,
  });
}

export function SaleReceiptDocument({
  sale,
}: {
  sale: ReceiptSaleView;
}) {
  const { title, detail } = receiptLineDescription(sale);
  const discount = receiptDiscountRm(sale);
  const dateLabel = formatReceiptDate(sale.soldAt);
  const phone = formatReceiptPhone(sale.clientWhatsapp);
  const paid = sale.status === "paid";
  const qty = receiptLineQty(sale);

  return (
    <article
      id="sale-receipt-print"
      className="mx-auto w-full bg-white text-black px-6 py-8"
      style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" }}
    >
      <header className="flex items-start justify-between gap-4">
        <FaseaReceiptLogo />
        <div className="text-right text-[10px] leading-relaxed text-black/85 max-w-[200px]">
          <div className="font-semibold text-xs">{STUDIO_RECEIPT.name}</div>
          {STUDIO_RECEIPT.addressLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
          <div>({STUDIO_RECEIPT.registrationNo})</div>
          <div>Tel: {STUDIO_RECEIPT.telDisplay}</div>
        </div>
      </header>

      <div className="mt-6 border-t border-black" />
      <h1
        className="py-2.5 text-center text-2xl font-bold tracking-wide"
        style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
      >
        RECEIPT
      </h1>
      <div className="border-t border-black" />

      <div className="mt-5 grid grid-cols-1 gap-5 text-[12px]">
        <dl className="space-y-1.5">
          <div className="grid grid-cols-[4.25rem_1fr] gap-x-2">
            <dt className="text-black/60">Name :</dt>
            <dd className="font-medium uppercase tracking-wide">
              {sale.clientName || "—"}
            </dd>
          </div>
          <div className="grid grid-cols-[4.25rem_1fr] gap-x-2">
            <dt className="text-black/60">Phone :</dt>
            <dd>{phone || "—"}</dd>
          </div>
          <div className="grid grid-cols-[4.25rem_1fr] gap-x-2">
            <dt className="text-black/60">Email :</dt>
            <dd className="break-all">{sale.clientEmail || "—"}</dd>
          </div>
        </dl>
        <dl className="space-y-1.5">
          <div className="grid grid-cols-[5.5rem_1fr] gap-x-2">
            <dt className="text-black/60">Receipt No :</dt>
            <dd className="font-medium">{sale.receiptNo}</dd>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-x-2">
            <dt className="text-black/60">Date :</dt>
            <dd>{dateLabel}</dd>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-x-2">
            <dt className="text-black/60">Due :</dt>
            <dd>{dateLabel}</dd>
          </div>
        </dl>
      </div>

      <table className="mt-8 w-full text-[12px]">
        <thead>
          <tr className="border-b border-black text-left text-[10px] uppercase tracking-wider">
            <th className="pb-2 font-semibold">Description</th>
            <th className="pb-2 font-semibold text-center w-16">Qty</th>
            <th className="pb-2 font-semibold text-right w-24">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="align-top">
            <td className="py-3 pr-3">
              <div className="font-medium">{title}</div>
              {detail ? (
                <div className="mt-1 text-[11px] text-black/55">{detail}</div>
              ) : null}
            </td>
            <td className="py-3 text-center">{qty}</td>
            <td className="py-3 text-right whitespace-nowrap">
              {formatReceiptMoney(sale.amountRm)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="border-t border-black/30" />

      <div className="mt-3 ml-auto w-full max-w-[200px] space-y-1.5 text-[12px]">
        <div className="flex justify-between gap-4">
          <span className="text-black/60">Subtotal</span>
          <span>{formatReceiptMoney(sale.listPriceRm || sale.amountRm)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-black/60">Discount</span>
          <span>
            {discount != null ? `− ${formatReceiptMoney(discount)}` : "—"}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t border-black pt-2 text-[14px] font-bold">
          <span>TOTAL</span>
          <span>{formatReceiptMoney(sale.amountRm)}</span>
        </div>
      </div>

      <div className="mt-8 space-y-1.5 text-[12px]">
        <div>
          <span className="text-black/60">Payment Status : </span>
          <span
            className={
              paid ? "font-semibold text-[#1B7A3D]" : "font-semibold text-[#B45309]"
            }
          >
            {paid ? "Fully Paid" : "Refunded"}
          </span>
        </div>
        <div>
          <span className="text-black/60">Payment Method : </span>
          <span>{sale.paymentMethod || STUDIO_RECEIPT.defaultPaymentMethod}</span>
        </div>
        <div>
          <span className="text-black/60">Payment Date : </span>
          <span>{dateLabel}</span>
        </div>
      </div>

      <div className="mt-6 text-[12px] leading-relaxed">
        <div className="font-semibold tracking-wide">PAYMENT INFO:</div>
        <div className="mt-1 font-bold">{STUDIO_RECEIPT.legalName}</div>
        <div>{STUDIO_RECEIPT.bankName}</div>
        <div>{STUDIO_RECEIPT.bankAccount}</div>
      </div>
    </article>
  );
}

export function SaleReceiptModal({
  sale,
  onClose,
}: {
  sale: ReceiptSaleView;
  onClose: () => void;
}) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filename = `${sale.receiptNo || "receipt"}.png`;

  const downloadReceipt = useCallback(async () => {
    const node = receiptRef.current?.querySelector(
      "#sale-receipt-print",
    ) as HTMLElement | null;
    if (!node) {
      setError("Receipt preview is not ready yet. Try again.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const dataUrl = await captureReceiptPng(node);
      triggerPngDownload(dataUrl, filename);
      setSaved(true);
    } catch (e) {
      setSaved(false);
      setError(e instanceof Error ? e.message : "Failed to save image");
    } finally {
      setSaving(false);
    }
  }, [filename]);

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Close receipt"
        onClick={onClose}
      />
      <div className="relative z-10 my-4 w-full max-w-[420px] rounded-2xl border border-[#E8DDD4] bg-[#FAF8F6] shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#E8DDD4] px-4 py-3">
          <div>
            <h3 className="font-serif text-lg font-semibold">Receipt</h3>
            <p className="text-xs text-[#716D64]">
              {saving
                ? "Preparing image…"
                : error
                  ? "Download failed"
                  : saved
                    ? `${sale.receiptNo} · saved`
                    : "Tap Download to save the receipt image"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void downloadReceipt()}
              className="rounded-full bg-[#DFD1C9] px-3 py-1.5 text-xs font-medium hover:brightness-95 disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Saving…" : saved ? "Download again" : "Download"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[#E8DDD4] bg-white px-3 py-1.5 text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
        {error ? (
          <div className="px-4 pt-3 text-sm text-red-700">{error}</div>
        ) : null}
        <div ref={receiptRef}>
          <SaleReceiptDocument sale={sale} />
        </div>
      </div>
    </div>
  );
}
