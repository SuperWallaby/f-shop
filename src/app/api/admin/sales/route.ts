import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { DateTime } from "luxon";
import { getCollections, type SaleDb, type SaleLineItemDb } from "@/lib/db";
import {
  adminSaleCreateSchema,
  adminSalesListQuerySchema,
} from "@/lib/schemas";
import {
  allocateSaleReceiptNo,
  applyPromotionDiscount,
  parseSaleSoldAt,
  serializeSale,
} from "@/lib/sales";
import {
  createOrderRef,
  resolvePlanListPriceRm,
  type PlanPriceMode,
} from "@/lib/credits";
import { planPayerHeads } from "@/lib/planHeads";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { requireAdmin } from "../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../_utils/http";

function emptyToUndef(v: string | undefined): string | undefined {
  const t = (v ?? "").trim();
  return t ? t : undefined;
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
    const soldAt = parseSaleSoldAt(d.soldAt);
    if (!soldAt) return jsonError("Invalid soldAt", 400);

    const {
      sales,
      clients,
      plans,
      items,
      promotions,
      shopProducts,
      creditLedger,
      orders,
    } = await getCollections();
    const now = new Date();
    const saleKind = d.saleKind ?? "plan";
    const alsoCreateOrder = Boolean(d.alsoCreateOrder);

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
    let saleItems: SaleLineItemDb[] | undefined;
    let classCount = d.classCount;
    let validityDays = d.validityDays;
    let listPriceRm = d.listPriceRm;

    if (saleKind === "product") {
      const rawLines =
        d.products && d.products.length > 0
          ? d.products
          : emptyToUndef(d.productId)
            ? [{ productId: d.productId!, quantity: d.quantity }]
            : [];
      if (rawLines.length === 0) {
        return jsonError("Add at least one product", 400);
      }

      const items: SaleLineItemDb[] = [];
      for (const line of rawLines) {
        const productIdRaw = emptyToUndef(line.productId);
        if (!productIdRaw || !ObjectId.isValid(productIdRaw)) {
          return jsonError("Invalid productId", 400);
        }
        const lineProductId = new ObjectId(productIdRaw);
        const product = await shopProducts.findOne({ _id: lineProductId });
        if (!product || !product.active) {
          return jsonError(`Product not found: ${productIdRaw}`, 404);
        }
        const qty = line.quantity && line.quantity > 0 ? line.quantity : 1;
        const unitPriceRm = product.priceRm;
        items.push({
          productId: lineProductId,
          productName: product.name,
          quantity: qty,
          unitPriceRm,
          lineAmountRm: unitPriceRm * qty,
        });
      }

      saleItems = items;
      productId = items[0]!.productId;
      productName =
        items.length === 1
          ? items[0]!.productName
          : items.map((i) => i.productName).join(" + ");
      quantity = items.reduce((sum, i) => sum + i.quantity, 0);
      classCount = 0;
      validityDays = 0;
      if (!d.amountOverridden || listPriceRm <= 0) {
        listPriceRm = items.reduce((sum, i) => sum + i.lineAmountRm, 0);
      }
      planId = undefined;
      planTitle = undefined;
    } else {
      const planIdRaw = emptyToUndef(d.planId);
      quantity = d.quantity && d.quantity > 0 ? d.quantity : 1;
      if (planIdRaw) {
        if (!ObjectId.isValid(planIdRaw)) return jsonError("Invalid planId", 400);
        planId = new ObjectId(planIdRaw);
        const plan = await plans.findOne({ _id: planId });
        if (!plan) return jsonError("Plan not found", 404);
        planTitle = plan.title;
        if (!d.amountOverridden) {
          if (!classCount) classCount = plan.classCount * quantity;
          if (!validityDays) validityDays = plan.validityDays;
        }
        if (listPriceRm <= 0 || !d.amountOverridden) {
          const mode: PlanPriceMode =
            d.priceMode ??
            (d.useStudentPrice ? "student" : "regular");
          const unit = resolvePlanListPriceRm(plan, mode);
          const heads = d.splitPayers ? 1 : planPayerHeads(plan.category);
          // Duet is /per head — full duo sale stores 2×; split sales store 1× each.
          listPriceRm = unit * quantity * heads;
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
    const planDoc = planId ? await plans.findOne({ _id: planId }) : null;
    const duoHeads =
      saleKind === "plan" && planDoc ? planPayerHeads(planDoc.category) : 1;

    type PayerInput = {
      clientId?: ObjectId;
      clientName: string;
      clientEmail?: string;
      clientWhatsapp?: string;
      listPriceRm: number;
      computedAmountRm: number;
      amountRm: number;
      amountOverridden: boolean;
      note?: string;
      heads: number;
    };

    const payers: PayerInput[] = [];
    let splitSaleGroupId: ObjectId | undefined;
    if (d.splitPayers && saleKind === "plan") {
      if (duoHeads < 2) {
        return jsonError("Split receipts are only for Duet plans", 400);
      }
      splitSaleGroupId = new ObjectId();
      const mode: PlanPriceMode =
        d.priceMode ?? (d.useStudentPrice ? "student" : "regular");
      const qty = quantity && quantity > 0 ? quantity : 1;
      const unitList = planDoc
        ? resolvePlanListPriceRm(planDoc, mode) * qty
        : listPriceRm;
      let unitComputed = unitList;
      if (promotionId) {
        const promo = await promotions.findOne({ _id: promotionId });
        if (promo) unitComputed = applyPromotionDiscount(unitList, promo);
      }
      for (const payer of d.splitPayers) {
        let pClientId: ObjectId | undefined;
        let pName = payer.clientName.trim();
        let pEmail = emptyToUndef(payer.clientEmail);
        let pWa = emptyToUndef(payer.clientWhatsapp);
        const pClientIdRaw = emptyToUndef(payer.clientId);
        if (pClientIdRaw) {
          if (!ObjectId.isValid(pClientIdRaw)) {
            return jsonError("Invalid split clientId", 400);
          }
          pClientId = new ObjectId(pClientIdRaw);
          const c = await clients.findOne({ _id: pClientId });
          if (!c) return jsonError(`Client not found: ${pName}`, 404);
          pName = pName || c.name || c.email;
          pEmail = pEmail || c.email || undefined;
          pWa = pWa || c.whatsapp || undefined;
        }
        payers.push({
          clientId: pClientId,
          clientName: pName,
          clientEmail: pEmail,
          clientWhatsapp: pWa,
          listPriceRm: unitList,
          computedAmountRm: unitComputed,
          amountRm: payer.amountRm,
          amountOverridden: true,
          note: emptyToUndef(payer.note) || emptyToUndef(d.note),
          heads: 1,
        });
      }
    } else {
      const amountRm = amountOverridden ? d.amountRm : computedAmountRm;
      payers.push({
        clientId,
        clientName,
        clientEmail,
        clientWhatsapp,
        listPriceRm,
        computedAmountRm,
        amountRm,
        amountOverridden,
        note: emptyToUndef(d.note),
        heads: saleKind === "plan" ? duoHeads : 1,
      });
    }

    const createdSales = [];
    let anyCredits = false;
    let anyOrder = false;

    for (const payer of payers) {
      const receiptNo = await allocateSaleReceiptNo(sales, soldAt);
      let orderId: ObjectId | undefined;
      if (alsoCreateOrder && payer.clientId && planId && planDoc) {
        const orderIns = await orders.insertOne({
          orderRef: createOrderRef(),
          clientId: payer.clientId,
          planId,
          planCode: planDoc.code,
          planTitle: planDoc.title,
          quantity: quantity && quantity > 0 ? quantity : 1,
          classCount,
          amountRm: payer.amountRm,
          currency: "MYR",
          status: "paid",
          whatsappMessage: payer.note
            ? `Admin sale + order. ${payer.note}`
            : "Admin sale linked order.",
          createdAt: now,
          paidAt: soldAt,
          ...(payer.note ? { adminNote: payer.note } : {}),
        });
        orderId = orderIns.insertedId;
        anyOrder = true;
      }

      const saleDoc: SaleDb = {
        soldAt,
        clientId: payer.clientId,
        clientName: payer.clientName,
        clientEmail: payer.clientEmail,
        clientWhatsapp: payer.clientWhatsapp,
        saleKind,
        itemId,
        itemName,
        planId,
        planTitle,
        productId,
        productName,
        quantity,
        ...(saleItems ? { items: saleItems } : {}),
        classCount,
        validityDays,
        promotionId,
        promotionName,
        listPriceRm: payer.listPriceRm,
        computedAmountRm: payer.computedAmountRm,
        amountRm: payer.amountRm,
        amountOverridden: payer.amountOverridden,
        currency: "MYR",
        status: "paid",
        receiptNo,
        paymentMethod: "Online transfer",
        note: payer.note,
        orderId,
        heads: payer.heads,
        ...(splitSaleGroupId ? { saleGroupId: splitSaleGroupId } : {}),
        createdAt: now,
        updatedAt: now,
      };

      const ins = await sales.insertOne(saleDoc);
      const saleId = ins.insertedId;

      if (orderId) {
        await orders.updateOne({ _id: orderId }, { $set: { saleId } });
      }

      if (saleKind === "plan" && payer.clientId && classCount > 0) {
        const expiresAt = new Date(
          soldAt.getTime() + validityDays * 24 * 60 * 60 * 1000,
        );
        const ledgerIns = await creditLedger.insertOne({
          clientId: payer.clientId,
          type: "purchase_grant",
          amount: classCount,
          expiresAt,
          expiryApproved: false,
          planId,
          saleId,
          ...(orderId ? { orderId } : {}),
          note:
            payer.note ||
            `Sale: ${planTitle || payer.clientName} (${payer.amountRm} MYR)`,
          createdAt: now,
        });
        await sales.updateOne(
          { _id: saleId },
          { $set: { creditLedgerId: ledgerIns.insertedId, updatedAt: now } },
        );
        anyCredits = true;
      }

      const created = await sales.findOne({ _id: saleId });
      if (created) createdSales.push(serializeSale(created));
    }

    if (createdSales.length === 0) return jsonError("Insert failed", 500);
    return jsonOk({
      sale: createdSales[0],
      sales: createdSales,
      creditsGranted: anyCredits,
      orderCreated: anyOrder,
      split: Boolean(splitSaleGroupId),
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
