import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { ensureDefaultPlans } from "@/lib/credits";
import { requireAdmin } from "../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../_utils/http";
import { adminPlanCreateSchema } from "@/lib/schemas";
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

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const { plans } = await getCollections();
    await ensureDefaultPlans(plans);
    const docs = await plans.find({}).sort({ sortOrder: 1, code: 1 }).toArray();
    return jsonOk({ plans: docs.map((p) => serializeAdminPlan(p)) });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const body = await req.json().catch(() => null);
    const parsed = adminPlanCreateSchema.safeParse(body);
    if (!parsed.success)
      return jsonError("Invalid body", 400, parsed.error.flatten());

    const { plans } = await getCollections();
    const now = new Date();
    const d = parsed.data;
    const doc = {
      code: d.code,
      title: d.title,
      cardTitle: d.cardTitle ?? undefined,
      category: d.category,
      classCount: d.classCount,
      priceRm: d.priceRm,
      studentPriceRm: d.studentPriceRm ?? undefined,
      listPriceRm: d.listPriceRm ?? undefined,
      validityDays: d.validityDays,
      active: d.active ?? true,
      sortOrder: d.sortOrder ?? 1000,
      detailLines: d.detailLines,
      priceNote: d.priceNote ?? undefined,
      promotionActive: d.promotionActive ?? false,
      promotionDiscount: d.promotionDiscount ?? undefined,
      promotionLabel: d.promotionLabel ?? undefined,
      createdAt: now,
      updatedAt: now,
    };
    const ins = await plans.insertOne(doc);
    const created = await plans.findOne({ _id: ins.insertedId });
    if (!created) return jsonError("Insert failed", 500);
    return jsonOk({ plan: serializeAdminPlan(created) });
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null && "code" in e ? (e as { code: number }).code : 0;
    if (code === 11000) return jsonError("A plan with this code already exists.", 409);
    return jsonError("Server error", 500, e instanceof Error ? e.message : String(e));
  }
}
