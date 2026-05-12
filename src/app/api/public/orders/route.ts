import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { publicCreateOrderSchema } from "@/lib/schemas";
import {
  buildPaymentWhatsappMessage,
  createOrderRef,
  ensureDefaultPlans,
  getOrderAmountForClient,
} from "@/lib/credits";
import { requireClient } from "@/app/api/_utils/clientAuth";
import { jsonError, jsonOk } from "@/app/api/_utils/http";

const STUDIO_WHATSAPP = "60145403560";

export async function POST(req: NextRequest) {
  const { clientId, response } = requireClient(req);
  if (response) return response;

  try {
    const body = await req.json().catch(() => null);
    const parsed = publicCreateOrderSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid body", 400, parsed.error.flatten());
    if (!ObjectId.isValid(parsed.data.planId)) return jsonError("Invalid planId", 400);

    const { clients, plans, orders } = await getCollections();
    await ensureDefaultPlans(plans);
    const [client, plan] = await Promise.all([
      clients.findOne({ _id: clientId! }),
      plans.findOne({ _id: new ObjectId(parsed.data.planId), active: true }),
    ]);
    if (!client) return jsonError("Client not found", 404);
    if (!plan) return jsonError("Plan not found", 404);

    const now = new Date();
    const amountRm = getOrderAmountForClient(plan, client);
    const draft = {
      orderRef: createOrderRef(),
      clientId: client._id!,
      planId: plan._id!,
      planCode: plan.code,
      planTitle: plan.title,
      classCount: plan.classCount,
      amountRm,
      currency: "MYR" as const,
      status: "pending" as const,
      whatsappMessage: "",
      createdAt: now,
    };
    const whatsappMessage = buildPaymentWhatsappMessage({
      client,
      plan,
      order: draft,
    });
    const insert = await orders.insertOne({ ...draft, whatsappMessage });
    const whatsappUrl = `https://wa.me/${STUDIO_WHATSAPP}?text=${encodeURIComponent(
      whatsappMessage,
    )}`;

    return jsonOk({
      order: {
        id: insert.insertedId.toHexString(),
        orderRef: draft.orderRef,
        planTitle: plan.title,
        amountRm,
        status: draft.status,
        whatsappUrl,
      },
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
