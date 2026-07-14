import { NextRequest } from "next/server";
import { getCollections, type ShopProductDb } from "@/lib/db";
import { adminShopProductCreateSchema } from "@/lib/schemas";
import { requireAdmin } from "../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../_utils/http";

function serialize(doc: ShopProductDb & { _id?: { toHexString(): string } }) {
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

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const { shopProducts } = await getCollections();
    const docs = await shopProducts
      .find({})
      .sort({ sortOrder: 1, name: 1 })
      .toArray();
    return jsonOk({ products: docs.map(serialize) });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const body = await req.json().catch(() => null);
    const parsed = adminShopProductCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }
    const { shopProducts } = await getCollections();
    const now = new Date();
    const d = parsed.data;
    const maxSort = await shopProducts
      .find({})
      .sort({ sortOrder: -1 })
      .limit(1)
      .toArray();
    const sortOrder =
      typeof d.sortOrder === "number"
        ? d.sortOrder
        : (maxSort[0]?.sortOrder ?? 0) + 10;
    const doc: ShopProductDb = {
      name: d.name.trim(),
      priceRm: d.priceRm,
      active: d.active ?? true,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    };
    const ins = await shopProducts.insertOne(doc);
    const created = await shopProducts.findOne({ _id: ins.insertedId });
    if (!created) return jsonError("Insert failed", 500);
    return jsonOk({ product: serialize(created) });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
