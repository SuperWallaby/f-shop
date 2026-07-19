import { NextRequest } from "next/server";
import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { adminSaleUpdateSchema } from "@/lib/schemas";
import { serializeSale } from "@/lib/sales";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { requireAdmin } from "../../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../../_utils/http";

function parseSoldAt(raw: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const dt = DateTime.fromISO(raw, { zone: BUSINESS_TIME_ZONE }).startOf(
      "day",
    );
    return dt.isValid ? dt.toJSDate() : null;
  }
  const dt = DateTime.fromISO(raw, { zone: BUSINESS_TIME_ZONE });
  return dt.isValid ? dt.toJSDate() : null;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) return jsonError("Invalid sale id", 400);

    const body = await req.json().catch(() => null);
    const parsed = adminSaleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }
    const d = parsed.data;
    const soldAt = parseSoldAt(d.soldAt);
    if (!soldAt) return jsonError("Invalid soldAt", 400);

    const { sales, creditLedger } = await getCollections();
    const saleId = new ObjectId(id);
    const sale = await sales.findOne({ _id: saleId });
    if (!sale) return jsonError("Sale not found", 404);

    const now = new Date();
    const isProduct =
      sale.saleKind === "product" ||
      Boolean(sale.productId || sale.productName);
    const classCount = isProduct ? 0 : d.classCount;
    const validityDays = isProduct ? 0 : d.validityDays;
    const quantity = isProduct ? d.quantity ?? sale.quantity ?? 1 : undefined;
    const update: Record<string, unknown> = {
      soldAt,
      clientName: d.clientName.trim(),
      classCount,
      validityDays,
      listPriceRm: d.listPriceRm,
      computedAmountRm: d.amountRm,
      amountRm: d.amountRm,
      amountOverridden: true,
      paymentMethod: d.paymentMethod.trim(),
      updatedAt: now,
    };
    if (isProduct) update.quantity = quantity;

    if (
      sale.status === "refunded" &&
      (sale.refundAmountRm == null || sale.refundAmountRm === sale.amountRm)
    ) {
      update.refundAmountRm = d.amountRm;
    }

    const unset: Record<string, ""> = {};
    if (d.clientEmail?.trim()) update.clientEmail = d.clientEmail.trim();
    else unset.clientEmail = "";
    if (d.clientWhatsapp?.trim()) {
      update.clientWhatsapp = d.clientWhatsapp.trim();
    } else {
      unset.clientWhatsapp = "";
    }
    if (d.note?.trim()) update.note = d.note.trim();
    else unset.note = "";

    await sales.updateOne(
      { _id: saleId },
      {
        $set: update,
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      },
    );

    let creditLedgerId = sale.creditLedgerId;
    if (!isProduct && sale.status === "paid" && sale.clientId) {
      const expiresAt = new Date(
        soldAt.getTime() + validityDays * 24 * 60 * 60 * 1000,
      );
      const ledgerUpdate = {
        clientId: sale.clientId,
        amount: classCount,
        expiresAt,
        planId: sale.planId,
        note:
          d.note?.trim() ||
          `Edited sale: ${sale.planTitle || d.clientName} (${d.amountRm} MYR)`,
      };
      if (creditLedgerId) {
        await creditLedger.updateOne(
          { _id: creditLedgerId },
          { $set: ledgerUpdate },
        );
      } else if (classCount > 0) {
        const inserted = await creditLedger.insertOne({
          ...ledgerUpdate,
          type: "purchase_grant",
          expiryApproved: false,
          saleId,
          createdAt: now,
        });
        creditLedgerId = inserted.insertedId;
        await sales.updateOne(
          { _id: saleId },
          { $set: { creditLedgerId, updatedAt: now } },
        );
      }
    }

    const updated = await sales.findOne({ _id: saleId });
    if (!updated) return jsonError("Update failed", 500);
    return jsonOk({
      sale: serializeSale(updated),
      creditsUpdated: Boolean(creditLedgerId),
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
