import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections, type SaleDb } from "@/lib/db";
import {
  allocateSaleReceiptNo,
  parseSaleSoldAt,
} from "@/lib/sales";
import { adminConfirmOrderSchema } from "@/lib/schemas";
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
    if (!ObjectId.isValid(id)) return jsonError("Invalid order id", 400);
    const body = await req.json().catch(() => ({}));
    const parsed = adminConfirmOrderSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const { orders, plans, creditLedger, sales, clients } =
      await getCollections();
    const orderId = new ObjectId(id);
    const order = await orders.findOne({ _id: orderId });
    if (!order) return jsonError("Order not found", 404);
    if (order.status === "paid") {
      return jsonOk({
        confirmed: true,
        saleCreated: Boolean(order.saleId),
      });
    }
    if (order.status !== "pending") {
      return jsonError("Order is not pending", 409);
    }

    const plan = await plans.findOne({ _id: order.planId });
    const client = await clients.findOne({ _id: order.clientId });
    const now = new Date();
    const alsoCreateSale = Boolean(parsed.data.alsoCreateSale);
    const validityDays = plan?.validityDays ?? 30;

    let businessAt = now;
    if (parsed.data.soldAt) {
      const parsedSold = parseSaleSoldAt(parsed.data.soldAt);
      if (!parsedSold) return jsonError("Invalid soldAt", 400);
      businessAt = parsedSold;
    }

    let saleId: ObjectId | undefined = order.saleId;
    if (alsoCreateSale && !saleId) {
      const receiptNo = await allocateSaleReceiptNo(sales, businessAt);
      const saleDoc: SaleDb = {
        soldAt: businessAt,
        clientId: order.clientId,
        clientName: client?.name || client?.email || order.planTitle,
        clientEmail: client?.email || undefined,
        clientWhatsapp: client?.whatsapp || undefined,
        saleKind: "plan",
        planId: order.planId,
        planTitle: order.planTitle,
        quantity: order.quantity && order.quantity > 0 ? order.quantity : 1,
        classCount: order.classCount,
        validityDays,
        listPriceRm: order.amountRm,
        computedAmountRm: order.amountRm,
        amountRm: order.amountRm,
        amountOverridden: true,
        currency: "MYR",
        status: "paid",
        receiptNo,
        paymentMethod: "Online transfer",
        note:
          parsed.data.note ||
          `Payment confirmed for ${order.orderRef}`,
        orderId,
        createdAt: now,
        updatedAt: now,
      };
      const saleIns = await sales.insertOne(saleDoc);
      saleId = saleIns.insertedId;
    }

    const expiresAt = new Date(
      businessAt.getTime() + validityDays * 24 * 60 * 60 * 1000,
    );
    const ledgerIns = await creditLedger.insertOne({
      clientId: order.clientId,
      type: "purchase_grant",
      amount: order.classCount,
      expiresAt,
      expiryApproved: false,
      orderId,
      ...(saleId ? { saleId } : {}),
      planId: order.planId,
      note: parsed.data.note || `Payment confirmed for ${order.orderRef}`,
      createdAt: now,
    });

    await orders.updateOne(
      { _id: orderId },
      {
        $set: {
          status: "paid",
          paidAt: businessAt,
          ...(saleId ? { saleId } : {}),
          ...(parsed.data.note ? { adminNote: parsed.data.note } : {}),
        },
      },
    );

    if (saleId) {
      await sales.updateOne(
        { _id: saleId },
        { $set: { creditLedgerId: ledgerIns.insertedId, updatedAt: now } },
      );
    }

    return jsonOk({
      confirmed: true,
      saleCreated: Boolean(saleId && alsoCreateSale),
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
