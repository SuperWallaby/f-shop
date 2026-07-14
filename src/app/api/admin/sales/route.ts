import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { DateTime } from "luxon";
import { getCollections, type SaleDb } from "@/lib/db";
import {
  adminSaleCreateSchema,
  adminSalesListQuerySchema,
} from "@/lib/schemas";
import {
  applyPromotionDiscount,
  serializeSale,
} from "@/lib/sales";
import {
  resolvePlanListPriceRm,
  type PlanPriceMode,
} from "@/lib/credits";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { buildReceiptNo } from "@/lib/studioReceipt";
import { requireAdmin } from "../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../_utils/http";

function emptyToUndef(v: string | undefined): string | undefined {
  const t = (v ?? "").trim();
  return t ? t : undefined;
}

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

async function allocateReceiptNo(
  sales: Awaited<ReturnType<typeof getCollections>>["sales"],
  soldAt: Date,
): Promise<string> {
  const day = DateTime.fromJSDate(soldAt, { zone: BUSINESS_TIME_ZONE });
  const from = day.startOf("day").toJSDate();
  const to = day.endOf("day").toJSDate();
  const count = await sales.countDocuments({
    soldAt: { $gte: from, $lte: to },
  });
  return buildReceiptNo(soldAt, count + 1);
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const parsed = adminSalesListQuerySchema.safeParse({
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });
    if (!parsed.success) {
      return jsonError("Invalid query", 400, parsed.error.flatten());
    }

    const filter: Record<string, unknown> = {};
    if (parsed.data.status && parsed.data.status !== "all") {
      filter.status = parsed.data.status;
    }
    if (parsed.data.from || parsed.data.to) {
      const range: Record<string, Date> = {};
      if (parsed.data.from) {
        const from = DateTime.fromISO(parsed.data.from, {
          zone: BUSINESS_TIME_ZONE,
        }).startOf("day");
        if (from.isValid) range.$gte = from.toJSDate();
      }
      if (parsed.data.to) {
        const to = DateTime.fromISO(parsed.data.to, {
          zone: BUSINESS_TIME_ZONE,
        }).endOf("day");
        if (to.isValid) range.$lte = to.toJSDate();
      }
      if (Object.keys(range).length) filter.soldAt = range;
    }

    const { sales } = await getCollections();
    const docs = await sales
      .find(filter)
      .sort({ soldAt: -1, createdAt: -1 })
      .limit(300)
      .toArray();
    return jsonOk({ sales: docs.map(serializeSale) });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const body = await req.json().catch(() => null);
    const parsed = adminSaleCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }
    const d = parsed.data;
    const soldAt = parseSoldAt(d.soldAt);
    if (!soldAt) return jsonError("Invalid soldAt", 400);

    const { sales, clients, plans, items, promotions, shopProducts, creditLedger } =
      await getCollections();
    const now = new Date();
    const saleKind = d.saleKind ?? "plan";

    let clientId: ObjectId | undefined;
    let clientName = d.clientName.trim();
    let clientEmail = emptyToUndef(d.clientEmail);
    let clientWhatsapp = emptyToUndef(d.clientWhatsapp);

    const clientIdRaw = emptyToUndef(d.clientId);
    if (clientIdRaw) {
      if (!ObjectId.isValid(clientIdRaw)) {
        return jsonError("Invalid clientId", 400);
      }
      clientId = new ObjectId(clientIdRaw);
      const client = await clients.findOne({ _id: clientId });
      if (!client) return jsonError("Client not found", 404);
      clientName = clientName || client.name || client.email;
      clientEmail = clientEmail || client.email || undefined;
      clientWhatsapp = clientWhatsapp || client.whatsapp || undefined;
    }

    let planId: ObjectId | undefined;
    let planTitle: string | undefined;
    let productId: ObjectId | undefined;
    let productName: string | undefined;
    let quantity: number | undefined;
    let classCount = d.classCount;
    let validityDays = d.validityDays;
    let listPriceRm = d.listPriceRm;

    if (saleKind === "product") {
      const productIdRaw = emptyToUndef(d.productId);
      if (!productIdRaw || !ObjectId.isValid(productIdRaw)) {
        return jsonError("Product is required", 400);
      }
      productId = new ObjectId(productIdRaw);
      const product = await shopProducts.findOne({ _id: productId });
      if (!product || !product.active) {
        return jsonError("Product not found", 404);
      }
      productName = product.name;
      quantity = d.quantity && d.quantity > 0 ? d.quantity : 1;
      classCount = 0;
      validityDays = 0;
      if (!d.amountOverridden || listPriceRm <= 0) {
        listPriceRm = product.priceRm * quantity;
      }
      planId = undefined;
      planTitle = undefined;
    } else {
      const planIdRaw = emptyToUndef(d.planId);
      if (planIdRaw) {
        if (!ObjectId.isValid(planIdRaw)) return jsonError("Invalid planId", 400);
        planId = new ObjectId(planIdRaw);
        const plan = await plans.findOne({ _id: planId });
        if (!plan) return jsonError("Plan not found", 404);
        planTitle = plan.title;
        if (!d.amountOverridden) {
          if (!classCount) classCount = plan.classCount;
          if (!validityDays) validityDays = plan.validityDays;
        }
        if (listPriceRm <= 0 || !d.amountOverridden) {
          const mode: PlanPriceMode =
            d.priceMode ??
            (d.useStudentPrice ? "student" : "regular");
          listPriceRm = resolvePlanListPriceRm(plan, mode);
        }
      }
    }

    let itemId: ObjectId | undefined;
    let itemName: string | undefined;
    if (saleKind === "plan") {
      const itemIdRaw = emptyToUndef(d.itemId);
      if (itemIdRaw) {
        if (!ObjectId.isValid(itemIdRaw)) return jsonError("Invalid itemId", 400);
        itemId = new ObjectId(itemIdRaw);
        const item = await items.findOne({ _id: itemId });
        if (!item) return jsonError("Class type not found", 404);
        itemName = item.name;
      }
    }

    let promotionId: ObjectId | undefined;
    let promotionName: string | undefined;
    let computedAmountRm = d.computedAmountRm;
    const promoIdRaw =
      saleKind === "plan" ? emptyToUndef(d.promotionId) : undefined;
    if (promoIdRaw) {
      if (!ObjectId.isValid(promoIdRaw)) {
        return jsonError("Invalid promotionId", 400);
      }
      promotionId = new ObjectId(promoIdRaw);
      const promo = await promotions.findOne({ _id: promotionId });
      if (!promo) return jsonError("Promotion not found", 404);
      promotionName = promo.name;
      computedAmountRm = applyPromotionDiscount(listPriceRm, promo);
    } else if (!d.amountOverridden) {
      computedAmountRm = listPriceRm;
    }

    const amountOverridden = Boolean(d.amountOverridden);
    const amountRm = amountOverridden ? d.amountRm : computedAmountRm;
    const receiptNo = await allocateReceiptNo(sales, soldAt);

    const saleDoc: SaleDb = {
      soldAt,
      clientId,
      clientName,
      clientEmail,
      clientWhatsapp,
      saleKind,
      itemId,
      itemName,
      planId,
      planTitle,
      productId,
      productName,
      quantity,
      classCount,
      validityDays,
      promotionId,
      promotionName,
      listPriceRm,
      computedAmountRm,
      amountRm,
      amountOverridden,
      currency: "MYR",
      status: "paid",
      receiptNo,
      paymentMethod: "Online transfer",
      note: emptyToUndef(d.note),
      createdAt: now,
      updatedAt: now,
    };

    const ins = await sales.insertOne(saleDoc);
    const saleId = ins.insertedId;

    let creditLedgerId: ObjectId | undefined;
    if (saleKind === "plan" && clientId && classCount > 0) {
      const expiresAt = new Date(
        soldAt.getTime() + validityDays * 24 * 60 * 60 * 1000,
      );
      const ledgerIns = await creditLedger.insertOne({
        clientId,
        type: "purchase_grant",
        amount: classCount,
        expiresAt,
        expiryApproved: false,
        planId,
        saleId,
        note:
          emptyToUndef(d.note) ||
          `Sale: ${planTitle || clientName} (${amountRm} MYR)`,
        createdAt: now,
      });
      creditLedgerId = ledgerIns.insertedId;
      await sales.updateOne(
        { _id: saleId },
        { $set: { creditLedgerId, updatedAt: now } },
      );
    }

    const created = await sales.findOne({ _id: saleId });
    if (!created) return jsonError("Insert failed", 500);
    return jsonOk({
      sale: serializeSale(created),
      creditsGranted: Boolean(creditLedgerId),
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
