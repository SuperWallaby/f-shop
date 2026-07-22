import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections, type SaleDb } from "@/lib/db";
import {
  createOrderRef,
  ensureDefaultPlans,
  getOrderAmountForClient,
} from "@/lib/credits";
import {
  allocateSaleReceiptNo,
  parseSaleSoldAt,
} from "@/lib/sales";
import { adminCreateClientOrderSchema } from "@/lib/schemas";
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
    if (!ObjectId.isValid(id)) return jsonError("Invalid client id", 400);

    const body = await req.json().catch(() => null);
    const parsed = adminCreateClientOrderSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }
    if (!ObjectId.isValid(parsed.data.planId)) {
      return jsonError("Invalid planId", 400);
    }

    const { clients, plans, orders, creditLedger, sales } =
      await getCollections();
    await ensureDefaultPlans(plans);

    const clientId = new ObjectId(id);
    const [client, plan] = await Promise.all([
      clients.findOne({ _id: clientId }),
      plans.findOne({ _id: new ObjectId(parsed.data.planId), active: true }),
    ]);
    if (!client) return jsonError("Client not found", 404);
    if (!plan) return jsonError("Plan not found", 404);

    const now = new Date();
    const markPaid = parsed.data.markPaid !== false;
    const alsoCreateSale = Boolean(parsed.data.alsoCreateSale) && markPaid;
    const classCount = parsed.data.classCount ?? plan.classCount;
    const amountRm =
      typeof parsed.data.amountRm === "number"
        ? parsed.data.amountRm
        : getOrderAmountForClient(plan, client);
    const note = parsed.data.note?.trim();
    const validityDays = plan.validityDays ?? 30;

    let businessAt = now;
    if (markPaid && parsed.data.soldAt) {
      const parsedSold = parseSaleSoldAt(parsed.data.soldAt);
      if (!parsedSold) return jsonError("Invalid soldAt", 400);
      businessAt = parsedSold;
    }

    const orderDoc = {
      orderRef: createOrderRef(),
      clientId,
      planId: plan._id!,
      planCode: plan.code,
      planTitle: plan.title,
      classCount,
      amountRm,
      currency: "MYR" as const,
      status: markPaid ? ("paid" as const) : ("pending" as const),
      whatsappMessage: note
        ? `Admin-added order. ${note}`
        : "Admin-added order.",
      createdAt: now,
      ...(markPaid ? { paidAt: businessAt } : {}),
      ...(note ? { adminNote: note } : {}),
    };

    const insert = await orders.insertOne(orderDoc);
    const orderId = insert.insertedId;

    let saleId: ObjectId | undefined;
    if (alsoCreateSale) {
      const receiptNo = await allocateSaleReceiptNo(sales, businessAt);
      const saleDoc: SaleDb = {
        soldAt: businessAt,
        clientId,
        clientName: client.name || client.email,
        clientEmail: client.email || undefined,
        clientWhatsapp: client.whatsapp || undefined,
        saleKind: "plan",
        planId: plan._id!,
        planTitle: plan.title,
        quantity: 1,
        classCount,
        validityDays,
        listPriceRm: amountRm,
        computedAmountRm: amountRm,
        amountRm,
        amountOverridden: true,
        currency: "MYR",
        status: "paid",
        receiptNo,
        paymentMethod: "Online transfer",
        note: note || `Order ${orderDoc.orderRef}`,
        orderId,
        createdAt: now,
        updatedAt: now,
      };
      const saleIns = await sales.insertOne(saleDoc);
      saleId = saleIns.insertedId;
      await orders.updateOne({ _id: orderId }, { $set: { saleId } });
    }

    if (markPaid && classCount > 0) {
      const expiresAt = new Date(
        businessAt.getTime() + validityDays * 24 * 60 * 60 * 1000,
      );
      const ledgerIns = await creditLedger.insertOne({
        clientId,
        type: "purchase_grant",
        amount: classCount,
        expiresAt,
        expiryApproved: false,
        orderId,
        ...(saleId ? { saleId } : {}),
        planId: plan._id!,
        note:
          note ||
          `Admin order ${orderDoc.orderRef} — ${plan.title} (${classCount} cr)`,
        createdAt: now,
      });
      if (saleId) {
        await sales.updateOne(
          { _id: saleId },
          { $set: { creditLedgerId: ledgerIns.insertedId, updatedAt: now } },
        );
      }
    }

    return jsonOk({
      order: {
        id: orderId.toHexString(),
        orderRef: orderDoc.orderRef,
        planTitle: plan.title,
        classCount,
        amountRm,
        status: orderDoc.status,
        paidAt: markPaid ? businessAt.toISOString() : null,
        saleId: saleId?.toHexString() ?? null,
      },
      saleCreated: Boolean(saleId),
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
