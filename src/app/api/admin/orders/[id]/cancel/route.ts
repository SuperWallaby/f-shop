import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { adminCancelOrderSchema } from "@/lib/schemas";
import { requireAdmin } from "../../../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../../../_utils/http";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) return jsonError("Invalid order id", 400);
    const body = await req.json().catch(() => ({}));
    const parsed = adminCancelOrderSchema.safeParse(body ?? {});
    if (!parsed.success) return jsonError("Invalid body", 400, parsed.error.flatten());

    const { orders } = await getCollections();
    const orderId = new ObjectId(id);
    const order = await orders.findOne({ _id: orderId });
    if (!order) return jsonError("Order not found", 404);
    if (order.status === "cancelled") return jsonOk({ cancelled: true });
    if (order.status === "paid") return jsonError("Cannot cancel a paid order", 409);
    if (order.status !== "pending") return jsonError("Order is not pending", 409);

    await orders.updateOne(
      { _id: orderId },
      {
        $set: {
          status: "cancelled",
          ...(parsed.data.note ? { adminNote: parsed.data.note } : {}),
        },
      },
    );

    return jsonOk({ cancelled: true });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
