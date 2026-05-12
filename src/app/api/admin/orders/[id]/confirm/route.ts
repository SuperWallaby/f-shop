import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { adminConfirmOrderSchema } from "@/lib/schemas";
import { requireAdmin } from "../../../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../../../_utils/http";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) return jsonError("Invalid order id", 400);
    const body = await req.json().catch(() => ({}));
    const parsed = adminConfirmOrderSchema.safeParse(body ?? {});
    if (!parsed.success) return jsonError("Invalid body", 400, parsed.error.flatten());

    const { orders, plans, creditLedger } = await getCollections();
    const orderId = new ObjectId(id);
    const order = await orders.findOne({ _id: orderId });
    if (!order) return jsonError("Order not found", 404);
    if (order.status === "paid") return jsonOk({ confirmed: true });
    if (order.status !== "pending") return jsonError("Order is not pending", 409);

    const plan = await plans.findOne({ _id: order.planId });
    const now = new Date();
    const validityDays = plan?.validityDays ?? 30;
    const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

    await creditLedger.insertOne({
      clientId: order.clientId,
      type: "purchase_grant",
      amount: order.classCount,
      expiresAt,
      orderId,
      planId: order.planId,
      note: parsed.data.note || `Payment confirmed for ${order.orderRef}`,
      createdAt: now,
    });
    await orders.updateOne(
      { _id: orderId },
      {
        $set: {
          status: "paid",
          paidAt: now,
          ...(parsed.data.note ? { adminNote: parsed.data.note } : {}),
        },
      },
    );

    return jsonOk({ confirmed: true });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
