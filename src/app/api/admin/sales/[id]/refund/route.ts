import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { adminSaleRefundSchema } from "@/lib/schemas";
import { serializeSale } from "@/lib/sales";
import { requireAdmin } from "../../../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../../../_utils/http";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) return jsonError("Invalid sale id", 400);
    const body = await req.json().catch(() => ({}));
    const parsed = adminSaleRefundSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const { sales, creditLedger } = await getCollections();
    const saleId = new ObjectId(id);
    const sale = await sales.findOne({ _id: saleId });
    if (!sale) return jsonError("Sale not found", 404);
    if (sale.status === "refunded") {
      return jsonOk({ sale: serializeSale(sale), alreadyRefunded: true });
    }

    const now = new Date();
    const refundAmountRm =
      parsed.data.refundAmountRm ?? sale.amountRm;
    const refundNote = (parsed.data.refundNote ?? "").trim() || undefined;
    const recallCredits = parsed.data.recallCredits !== false;

    let refundLedgerId: ObjectId | undefined;
    if (recallCredits && sale.clientId && sale.classCount > 0) {
      const ledgerIns = await creditLedger.insertOne({
        clientId: sale.clientId,
        type: "admin_adjust",
        amount: -Math.abs(sale.classCount),
        planId: sale.planId,
        saleId,
        note:
          refundNote ||
          `Refund recall for sale ${saleId.toHexString()}`,
        createdAt: now,
      });
      refundLedgerId = ledgerIns.insertedId;
    }

    await sales.updateOne(
      { _id: saleId },
      {
        $set: {
          status: "refunded",
          refundedAt: now,
          refundAmountRm,
          refundNote,
          refundLedgerId,
          updatedAt: now,
        },
      },
    );

    const updated = await sales.findOne({ _id: saleId });
    if (!updated) return jsonError("Update failed", 500);
    return jsonOk({
      sale: serializeSale(updated),
      creditsRecalled: Boolean(refundLedgerId),
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
