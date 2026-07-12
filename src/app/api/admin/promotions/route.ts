import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { adminPromotionCreateSchema } from "@/lib/schemas";
import { parsePlanObjectIds, serializePromotion } from "@/lib/sales";
import { requireAdmin } from "../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../_utils/http";

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("active") === "1";
    const { promotions } = await getCollections();
    const filter = activeOnly ? { active: true } : {};
    const docs = await promotions
      .find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .toArray();
    return jsonOk({ promotions: docs.map(serializePromotion) });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const body = await req.json().catch(() => null);
    const parsed = adminPromotionCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }
    const d = parsed.data;
    if (d.discountType === "percent" && (d.discountValue ?? 0) > 100) {
      return jsonError("Percent discount cannot exceed 100", 400);
    }
    if (d.discountType === "other" && !(d.discountLabel ?? "").trim()) {
      return jsonError("Discount label is required for “Something else”", 400);
    }
    if (d.showAsModal && !(d.imageUrl ?? "").trim()) {
      return jsonError("Modal popup requires an image", 400);
    }

    const { promotions } = await getCollections();
    const now = new Date();
    const imageUrl = (d.imageUrl ?? "").trim() || undefined;
    const modalLink = (d.modalLink ?? "").trim() || undefined;
    const ins = await promotions.insertOne({
      name: d.name,
      description: d.description?.trim() || undefined,
      discountType: d.discountType,
      discountValue: d.discountValue ?? 0,
      discountLabel: d.discountLabel?.trim() || undefined,
      badgeLabel: d.badgeLabel?.trim() || undefined,
      planIds: parsePlanObjectIds(d.planIds),
      imageUrl,
      showAsModal: Boolean(d.showAsModal),
      modalLink,
      active: d.active ?? true,
      sortOrder: d.sortOrder ?? 100,
      createdAt: now,
      updatedAt: now,
    });
    const created = await promotions.findOne({ _id: ins.insertedId });
    if (!created) return jsonError("Insert failed", 500);
    return jsonOk({ promotion: serializePromotion(created) });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
