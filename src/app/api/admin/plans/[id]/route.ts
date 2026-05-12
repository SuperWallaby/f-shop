import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { requireAdmin } from "../../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../../_utils/http";
import { adminPlanPatchSchema } from "@/lib/schemas";
import { planDocToPublicDto } from "@/lib/planDto";

function serializeAdminPlan(plan: Parameters<typeof planDocToPublicDto>[0] & {
  active: boolean;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const base = planDocToPublicDto(plan);
  return {
    ...base,
    active: plan.active,
    sortOrder: plan.sortOrder,
    createdAt: plan.createdAt?.toISOString() ?? null,
    updatedAt: plan.updatedAt?.toISOString() ?? null,
  };
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return jsonError("Invalid id", 400);

  try {
    const body = await req.json().catch(() => null);
    const parsed = adminPlanPatchSchema.safeParse(body);
    if (!parsed.success)
      return jsonError("Invalid body", 400, parsed.error.flatten());

    const data = parsed.data;
    if (Object.keys(data).length === 0)
      return jsonError("No fields to update", 400);

    const { plans } = await getCollections();
    const _id = new ObjectId(id);
    const existing = await plans.findOne({ _id });
    if (!existing) return jsonError("Plan not found", 404);

    const $set: Record<string, unknown> = { updatedAt: new Date() };
    const $unset: Record<string, string> = {};

    const assign = (key: string, value: unknown) => {
      if (value === undefined) return;
      if (value === null) {
        $unset[key] = "";
        return;
      }
      $set[key] = value;
    };

    assign("title", data.title);
    assign("cardTitle", data.cardTitle);
    assign("category", data.category);
    assign("classCount", data.classCount);
    assign("priceRm", data.priceRm);
    assign("studentPriceRm", data.studentPriceRm);
    assign("listPriceRm", data.listPriceRm);
    assign("validityDays", data.validityDays);
    assign("active", data.active);
    assign("sortOrder", data.sortOrder);
    assign("detailLines", data.detailLines);
    assign("priceNote", data.priceNote);
    assign("promotionActive", data.promotionActive);
    assign("promotionDiscount", data.promotionDiscount);
    assign("promotionLabel", data.promotionLabel);

    const update: Record<string, unknown> = { $set };
    if (Object.keys($unset).length) update.$unset = $unset;

    await plans.updateOne({ _id }, update);
    const next = await plans.findOne({ _id });
    if (!next) return jsonError("Plan not found", 404);
    return jsonOk({ plan: serializeAdminPlan(next) });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
