import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { parseSaleSoldAt } from "@/lib/sales";
import { adminOrderUpdateSchema } from "@/lib/schemas";
import { requireAdmin } from "../../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../../_utils/http";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) return jsonError("Invalid order id", 400);

    const body = await req.json().catch(() => null);
    const parsed = adminOrderUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }
    const d = parsed.data;
    if (
      d.paidAt == null &&
      d.classCount == null &&
      d.amountRm == null &&
      d.note == null
    ) {
      return jsonError("Nothing to update", 400);
    }

    const { orders, plans, sales, creditLedger } = await getCollections();
    const orderId = new ObjectId(id);
    const order = await orders.findOne({ _id: orderId });
    if (!order) return jsonError("Order not found", 404);
    if (order.status === "cancelled") {
      return jsonError("Cancelled orders cannot be edited", 409);
    }

    const now = new Date();
    const set: Record<string, unknown> = {};

    let paidAt = order.paidAt;
    if (d.paidAt) {
      const parsedPaid = parseSaleSoldAt(d.paidAt);
      if (!parsedPaid) return jsonError("Invalid paidAt", 400);
      if (order.status === "paid" || order.paidAt) {
        paidAt = parsedPaid;
        set.paidAt = parsedPaid;
      } else {
        return jsonError("Cannot set paidAt on a pending order — confirm first", 409);
      }
    }

    if (typeof d.classCount === "number") set.classCount = d.classCount;
    if (typeof d.amountRm === "number") set.amountRm = d.amountRm;
    if (d.note !== undefined) {
      if (d.note.trim()) set.adminNote = d.note.trim();
    }

    if (Object.keys(set).length) {
      await orders.updateOne({ _id: orderId }, { $set: set });
    }

    const classCount =
      typeof d.classCount === "number" ? d.classCount : order.classCount;
    const amountRm =
      typeof d.amountRm === "number" ? d.amountRm : order.amountRm;

    const saleId = order.saleId;
    if (saleId && (d.paidAt || d.classCount != null || d.amountRm != null)) {
      const saleSet: Record<string, unknown> = { updatedAt: now };
      if (d.paidAt && paidAt) saleSet.soldAt = paidAt;
      if (d.classCount != null) saleSet.classCount = classCount;
      if (d.amountRm != null) {
        saleSet.amountRm = amountRm;
        saleSet.computedAmountRm = amountRm;
        saleSet.amountOverridden = true;
      }
      await sales.updateOne({ _id: saleId }, { $set: saleSet });
    }

    const plan = await plans.findOne({ _id: order.planId });
    const validityDays = plan?.validityDays ?? 30;
    const businessAt = paidAt ?? order.paidAt ?? order.createdAt;
    const expiresAt = new Date(
      businessAt.getTime() + validityDays * 24 * 60 * 60 * 1000,
    );

    if (order.status === "paid" && (d.paidAt || d.classCount != null)) {
      const ledgerFilter = saleId
        ? { $or: [{ orderId }, { saleId }] }
        : { orderId };
      await creditLedger.updateMany(
        {
          ...ledgerFilter,
          type: "purchase_grant",
        },
        {
          $set: {
            ...(d.classCount != null ? { amount: classCount } : {}),
            ...(d.paidAt ? { expiresAt } : {}),
          },
        },
      );
    }

    const updated = await orders.findOne({ _id: orderId });
    if (!updated) return jsonError("Update failed", 500);

    return jsonOk({
      order: {
        id: updated._id!.toHexString(),
        orderRef: updated.orderRef,
        planTitle: updated.planTitle,
        status: updated.status,
        classCount: updated.classCount,
        amountRm: updated.amountRm,
        createdAt: updated.createdAt.toISOString(),
        paidAt: updated.paidAt?.toISOString() ?? null,
        saleId: updated.saleId?.toHexString() ?? null,
      },
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
