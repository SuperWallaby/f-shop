import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { adminPromotionPatchSchema } from "@/lib/schemas";
import { parsePlanObjectIds, serializePromotion } from "@/lib/sales";
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
    if (!ObjectId.isValid(id)) return jsonError("Invalid promotion id", 400);
    const body = await req.json().catch(() => null);
    const parsed = adminPromotionPatchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }
    const d = parsed.data;
    if (
      d.discountType === "percent" &&
      d.discountValue !== undefined &&
      d.discountValue > 100
    ) {
      return jsonError("Percent discount cannot exceed 100", 400);
    }
    if (d.discountType === "other" && d.discountLabel !== undefined) {
      if (!d.discountLabel.trim()) {
        return jsonError("Discount label is required for “Something else”", 400);
      }
    }

    const { promotions } = await getCollections();
    const existing = await promotions.findOne({ _id: new ObjectId(id) });
    if (!existing) return jsonError("Promotion not found", 404);

    const nextType = d.discountType ?? existing.discountType;
    const nextLabel =
      d.discountLabel !== undefined
        ? d.discountLabel.trim()
        : existing.discountLabel ?? "";
    if (nextType === "other" && !nextLabel) {
      return jsonError("Discount label is required for “Something else”", 400);
    }

    const nextImage =
      d.imageUrl !== undefined
        ? d.imageUrl.trim() || undefined
        : existing.imageUrl;
    const nextShowModal =
      d.showAsModal !== undefined ? d.showAsModal : Boolean(existing.showAsModal);
    if (nextShowModal && !nextImage) {
      return jsonError("Modal popup requires an image", 400);
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (d.name !== undefined) patch.name = d.name;
    if (d.description !== undefined) {
      patch.description = d.description.trim() || undefined;
    }
    if (d.discountType !== undefined) patch.discountType = d.discountType;
    if (d.discountValue !== undefined) patch.discountValue = d.discountValue;
    if (d.discountLabel !== undefined) {
      patch.discountLabel = d.discountLabel.trim() || undefined;
    }
    if (d.badgeLabel !== undefined) {
      patch.badgeLabel = d.badgeLabel.trim() || undefined;
    }
    if (d.planIds !== undefined) patch.planIds = parsePlanObjectIds(d.planIds);
    if (d.imageUrl !== undefined) {
      patch.imageUrl = d.imageUrl.trim() || undefined;
    }
    if (d.showAsModal !== undefined) patch.showAsModal = d.showAsModal;
    if (d.modalLink !== undefined) {
      patch.modalLink = d.modalLink.trim() || undefined;
    }
    if (d.active !== undefined) patch.active = d.active;
    if (d.sortOrder !== undefined) patch.sortOrder = d.sortOrder;

    const res = await promotions.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: patch },
      { returnDocument: "after" },
    );
    if (!res) return jsonError("Promotion not found", 404);
    return jsonOk({ promotion: serializePromotion(res) });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
