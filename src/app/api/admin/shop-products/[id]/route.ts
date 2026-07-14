import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { adminShopProductPatchSchema } from "@/lib/schemas";
import { requireAdmin } from "../../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../../_utils/http";

function serialize(doc: {
  _id?: ObjectId;
  name: string;
  priceRm: number;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: doc._id?.toHexString() ?? "",
    name: doc.name,
    priceRm: doc.priceRm,
    active: doc.active,
    sortOrder: doc.sortOrder,
    createdAt: doc.createdAt?.toISOString() ?? null,
    updatedAt: doc.updatedAt?.toISOString() ?? null,
  };
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) return jsonError("Invalid id", 400);
    const body = await req.json().catch(() => null);
    const parsed = adminShopProductPatchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }
    const { shopProducts } = await getCollections();
    const $set: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name != null) $set.name = parsed.data.name.trim();
    if (typeof parsed.data.priceRm === "number") $set.priceRm = parsed.data.priceRm;
    if (typeof parsed.data.active === "boolean") $set.active = parsed.data.active;
    if (typeof parsed.data.sortOrder === "number") {
      $set.sortOrder = parsed.data.sortOrder;
    }
    const res = await shopProducts.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set },
      { returnDocument: "after" },
    );
    if (!res) return jsonError("Not found", 404);
    return jsonOk({ product: serialize(res) });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
