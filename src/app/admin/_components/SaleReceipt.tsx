"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getFontEmbedCSS, toPng } from "html-to-image";
import {
  formatReceiptDate,
  formatReceiptMoney,
  formatReceiptPhone,
  receiptDiscountRm,
  receiptTableLines,
  STUDIO_RECEIPT,
  type ReceiptSaleView,
} from "@/lib/studioReceipt";

/** Display size on the receipt (CSS px). Asset is ~3× for crisp capture. */
const RECEIPT_LOGO = {
  src: "/receipt-logo.png",
  cssWidth: 64,
  cssHeight: 90,
} as const;

function FaseaReceiptLogo({ className }: { className?: string }) {
  return (
    <div className={className} style={{ flexShrink: 0, width: RECEIPT_LOGO.cssWidth }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={RECEIPT_LOGO.src}
        alt="Faséa Pilates"
        crossOrigin="anonymous"
        decoding="sync"
        width={RECEIPT_LOGO.cssWidth}
        height={RECEIPT_LOGO.cssHeight}
        style={{
          display: "block",
          width: RECEIPT_LOGO.cssWidth,
          height: RECEIPT_LOGO.cssHeight,
          objectFit: "contain",
        }}
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

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

/**
 * Downscale with canvas (high quality) to exact capture pixels so Safari
 * html-to-image doesn't soft-rescale a huge P3 source bitmap.
 */
async function crispLogoDataUrl(
  sourceSrc: string,
  cssWidth: number,
  cssHeight: number,
  pixelRatio: number,
): Promise<string> {
  const source = await loadImageElement(sourceSrc);
  const w = Math.max(1, Math.round(cssWidth * pixelRatio));
  const h = Math.max(1, Math.round(cssHeight * pixelRatio));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, w, h);
  // Contain-fit into the box (same as object-fit: contain).
  const srcRatio = source.naturalWidth / source.naturalHeight;
  const boxRatio = w / h;
  let dw = w;
  let dh = h;
  let dx = 0;
  let dy = 0;
  if (srcRatio > boxRatio) {
    dh = Math.round(w / srcRatio);
    dy = Math.round((h - dh) / 2);
  } else {
    dw = Math.round(h * srcRatio);
    dx = Math.round((w - dw) / 2);
  }
  ctx.drawImage(source, dx, dy, dw, dh);
  return canvas.toDataURL("image/png");
}

/** html-to-image often drops / softens images unless inlined at capture pixel size. */
async function inlineImagesAsDataUrls(root: HTMLElement, pixelRatio: number) {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src") || img.currentSrc || "";
      if (!src || src.startsWith("data:")) return;
      try {
        const absolute = new URL(src, window.location.origin).toString();
        const cssW =
          img.clientWidth ||
          Number(img.getAttribute("width")) ||
          RECEIPT_LOGO.cssWidth;
        const cssH =
          img.clientHeight ||
          Number(img.getAttribute("height")) ||
          RECEIPT_LOGO.cssHeight;
        const dataUrl = absolute.includes("receipt-logo") || absolute.includes("logo.png")
          ? await crispLogoDataUrl(absolute, cssW, cssH, pixelRatio)
          : await (async () => {
              const res = await fetch(absolute, {
                mode: "cors",
                credentials: "omit",
                cache: "force-cache",
              });
              if (!res.ok) throw new Error("fetch failed");
              const blob = await res.blob();
              return new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () =>
                  reject(reader.error ?? new Error("read failed"));
                reader.readAsDataURL(blob);
              });
            })();
        img.removeAttribute("crossorigin");
        img.removeAttribute("width");
        img.removeAttribute("height");
        img.src = dataUrl;
        // CSS size stays logical; bitmap is already @ pixelRatio for a 1:1 draw.
        img.style.width = `${cssW}px`;
        img.style.height = `${cssH}px`;
        img.style.objectFit = "fill";
        await new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      } catch {
        // Leave original src; capture may still omit the image.
      }
    }),
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

function isIosLikeDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  // iPadOS 13+ can report as MacIntel with touch.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  if (!header || data == null) {
    throw new Error("Invalid image data");
  }
  const mime = /data:(.*?);/.exec(header)?.[1] ?? "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

type SaveReceiptResult =
  | { mode: "shared" }
  | { mode: "downloaded" }
  | { mode: "preview"; objectUrl: string };

/**
 * iPad/iPhone Safari often ignores <a download>. Prefer Web Share (Save Image),
 * then blob download; fall back to an on-screen image for long-press save.
 */
async function saveReceiptImage(
  dataUrl: string,
  filename: string,
): Promise<SaveReceiptResult> {
  const blob = dataUrlToBlob(dataUrl);
  const file = new File([blob], filename, { type: "image/png" });
  const canShareFiles =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  if (canShareFiles) {
    try {
      await navigator.share({
        files: [file],
        title: filename.replace(/\.png$/i, ""),
      });
      return { mode: "shared" };
    } catch (e) {
      // User cancelled the share sheet — treat as intentional, not an error.
      if (e instanceof DOMException && e.name === "AbortError") {
        throw e;
      }
      // Fall through to download / preview.
    }
  }

  const objectUrl = URL.createObjectURL(blob);

  // Desktop / most Android: blob + download attribute works.
  if (!isIosLikeDevice()) {
    const link = document.createElement("a");
    link.download = filename;
    link.href = objectUrl;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Keep URL alive briefly for the download, then revoke.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return { mode: "downloaded" };
  }

  // iOS: show preview so they can long-press → Save to Photos / Share.
  return { mode: "preview", objectUrl };
}

async function captureReceiptPng(node: HTMLElement): Promise<string> {
  const pixelRatio = 2;
  await waitForReceiptImages(node);
  await inlineImagesAsDataUrls(node, pixelRatio);
  await waitForReceiptFonts();
  // Give layout/fonts one paint before rasterizing.
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => resolve()),
  );
  const fontEmbedCSS = await getFontEmbedCSS(node);
  return toPng(node, {
    // Images are already data URLs at capture pixel size.
    cacheBust: false,
    pixelRatio,
    backgroundColor: "#ffffff",
    fontEmbedCSS,
    // Prefer solid paints — opacity colors double-draw weirdly in some clones.
    style: {
      // Ensure the cloned root doesn't inherit conflicting line-height.
      lineHeight: "normal",
    },
  });
}

export function SaleReceiptDocument({
  sale,
}: {
  sale: ReceiptSaleView;
}) {
  const lines = receiptTableLines(sale);
  const discount = receiptDiscountRm(sale);
  const dateLabel = formatReceiptDate(sale.soldAt);
  const phone = formatReceiptPhone(sale.clientWhatsapp);
  const paid = sale.status === "paid";

  return (
    <article
      id="sale-receipt-print"
      className="mx-auto w-full bg-white text-black px-6 py-8"
      style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <FaseaReceiptLogo />
        {/*
          Use explicit px line-height / solid colors — Tailwind opacity + rem
          line-height often overlaps when html-to-image clones on Safari/iPad.
        */}
        <div
          style={{
            textAlign: "right",
            fontSize: 10,
            lineHeight: "15px",
            color: "#333333",
            maxWidth: 200,
            minWidth: 0,
            flex: "1 1 auto",
            letterSpacing: "0px",
            fontFamily: "Helvetica, Arial, sans-serif",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              lineHeight: "16px",
              color: "#000000",
              marginBottom: 4,
            }}
          >
            {STUDIO_RECEIPT.name}
          </div>
          {STUDIO_RECEIPT.addressLines.map((line) => (
            <div
              key={line}
              style={{
                lineHeight: "15px",
                margin: 0,
                padding: 0,
                whiteSpace: "normal",
              }}
            >
              {line}
            </div>
          ))}
          <div style={{ lineHeight: "15px", marginTop: 2 }}>
            ({STUDIO_RECEIPT.registrationNo})
          </div>
          <div style={{ lineHeight: "15px" }}>
            Tel: {STUDIO_RECEIPT.telDisplay}
          </div>
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
          {lines.map((line, idx) => (
            <tr key={`${line.title}-${idx}`} className="align-top">
              <td className="py-3 pr-3">
                <div className="font-medium">{line.title}</div>
                {line.detail ? (
                  <div className="mt-1 text-[11px] text-black/55">
                    {line.detail}
                  </div>
                ) : null}
              </td>
              <td className="py-3 text-center">{line.quantity}</td>
              <td className="py-3 text-right whitespace-nowrap">
                {formatReceiptMoney(line.amountRm)}
              </td>
            </tr>
          ))}
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
        {sale.includedReceiptNos && sale.includedReceiptNos.length > 0 ? (
          <div>
            <span className="text-black/60">Also includes : </span>
            <span>{sale.includedReceiptNos.join(", ")}</span>
          </div>
        ) : null}
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

export type ReceiptCandidate = {
  id: string;
  label: string;
  receiptNo: string;
  amountRm: number;
  view: ReceiptSaleView;
};

export function SaleReceiptModal({
  sale,
  candidates = [],
  includedExtras = [],
  onAddSale,
  onRemoveExtra,
  onClose,
}: {
  sale: ReceiptSaleView;
  /** Other sales that can be merged onto this print (same client). */
  candidates?: ReceiptCandidate[];
  /** Sales already added (excluding the anchor). */
  includedExtras?: Array<{ id: string; receiptNo: string; label: string }>;
  onAddSale?: (id: string) => void;
  onRemoveExtra?: (id: string) => void;
  onClose: () => void;
}) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickId, setPickId] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saveLabel, setSaveLabel] = useState("Download");
  const filename = `${sale.receiptNo || "receipt"}.png`;
  const extraCount = includedExtras.length;

  useEffect(() => {
    if (isIosLikeDevice()) setSaveLabel("Share / Save");
  }, []);

  const closePreview = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

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
    closePreview();
    try {
      const dataUrl = await captureReceiptPng(node);
      const result = await saveReceiptImage(dataUrl, filename);
      if (result.mode === "preview") {
        setPreviewUrl(result.objectUrl);
        setSaved(false);
      } else {
        setSaved(true);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        // User dismissed the share sheet — not a failure.
        setSaved(false);
        return;
      }
      setSaved(false);
      setError(e instanceof Error ? e.message : "Failed to save image");
    } finally {
      setSaving(false);
    }
  }, [closePreview, filename]);

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Close receipt"
        onClick={() => {
          closePreview();
          onClose();
        }}
      />
      <div className="relative z-10 my-4 w-full max-w-[420px] rounded-2xl border border-[#E8DDD4] bg-[#FAF8F6] shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#E8DDD4] px-4 py-3">
          <div>
            <h3 className="font-serif text-lg font-semibold">Receipt</h3>
            <p className="text-xs text-[#716D64]">
              {saving
                ? "Preparing image…"
                : error
                  ? "Save failed"
                  : previewUrl
                    ? "Long-press the image below → Save to Photos"
                    : saved
                      ? `${sale.receiptNo} · saved`
                      : extraCount > 0
                        ? `${extraCount + 1} sales on one receipt`
                        : `Tap ${saveLabel} to keep the receipt image`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void downloadReceipt()}
              className="rounded-full bg-[#DFD1C9] px-3 py-1.5 text-xs font-medium hover:brightness-95 disabled:opacity-50 cursor-pointer"
            >
              {saving
                ? "Saving…"
                : saved
                  ? "Save again"
                  : saveLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                closePreview();
                onClose();
              }}
              className="rounded-full border border-[#E8DDD4] bg-white px-3 py-1.5 text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
        {onAddSale ? (
          <div className="border-b border-[#E8DDD4] px-4 py-3 space-y-2">
            <p className="text-xs text-[#716D64]">
              Add another sale (plan or product) onto this receipt
            </p>
            {candidates.length > 0 ? (
              <div className="flex gap-2">
                <select
                  value={pickId}
                  onChange={(e) => setPickId(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-[#E8DDD4] bg-white px-3 py-2 text-xs"
                >
                  <option value="">Select sale…</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} · {c.receiptNo} · RM {c.amountRm}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!pickId}
                  onClick={() => {
                    if (!pickId) return;
                    onAddSale(pickId);
                    setPickId("");
                  }}
                  className="shrink-0 rounded-xl bg-[#DFD1C9] px-3 py-2 text-xs font-medium hover:brightness-95 disabled:opacity-40 cursor-pointer"
                >
                  Add
                </button>
              </div>
            ) : (
              <p className="text-xs text-[#716D64]">
                No other sales for this client in the current list.
              </p>
            )}
            {includedExtras.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {includedExtras.map((extra) => (
                  <span
                    key={extra.id}
                    className="inline-flex items-center gap-1 rounded-full border border-[#E8DDD4] bg-white px-2 py-0.5 text-[11px] text-[#716D64]"
                  >
                    {extra.label} · {extra.receiptNo}
                    {onRemoveExtra ? (
                      <button
                        type="button"
                        onClick={() => onRemoveExtra(extra.id)}
                        className="ml-0.5 text-[#A66A4A] underline cursor-pointer"
                      >
                        remove
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <div className="px-4 pt-3 text-sm text-red-700">{error}</div>
        ) : null}
        {previewUrl ? (
          <div className="border-b border-[#E8DDD4] px-4 py-3">
            <p className="mb-2 text-xs text-[#716D64]">
              iPad/Safari can’t auto-download files. Long-press the image →{" "}
              <span className="font-medium text-[#444444]">Save to Photos</span>{" "}
              or Share.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={filename}
              className="w-full rounded-xl border border-[#E8DDD4] bg-white"
            />
          </div>
        ) : null}
        <div ref={receiptRef}>
          <SaleReceiptDocument sale={sale} />
        </div>
      </div>
    </div>
  );
}
