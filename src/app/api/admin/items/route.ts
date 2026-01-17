import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../_utils/http";
import { requireAdmin } from "../../_utils/adminAuth";
import { z } from "zod";
import { normalizeHexColor, pickUnusedPastelRandom } from "@/lib/itemColor";

const createItemSchema = z.object({
 name: z.string().trim().min(1).max(120),
 description: z.string().trim().max(2000).default(""),
 capacity: z.number().int().min(1).max(1000),
 sortOrder: z.number().int().min(0).max(1000000).optional(),
 exclusiveKey: z.string().trim().max(64).optional(),
 color: z.string().trim().optional(),
 autoCancelEnabled: z.boolean().optional(),
 autoCancelMinBookings: z.number().int().min(1).max(100).optional(),
 autoCancelCutoffHours: z.number().int().min(1).max(168).optional(),
 active: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
 const auth = requireAdmin(req);
 if (auth) return auth;

 try {
  const { items } = await getCollections();
  const docs = await items
   .find({})
   .sort({ sortOrder: 1, createdAt: -1 })
   .limit(200)
   .toArray();
  return jsonOk({
   items: docs.map((it) => ({
    id: it._id!.toHexString(),
    name: it.name,
    description: it.description,
    capacity: it.capacity,
    sortOrder: typeof it.sortOrder === "number" ? it.sortOrder : null,
    color: it.color ?? "",
    autoCancelEnabled: Boolean(it.autoCancelEnabled),
    autoCancelMinBookings: it.autoCancelMinBookings ?? null,
    autoCancelCutoffHours: it.autoCancelCutoffHours ?? null,
    exclusiveKey: it.exclusiveKey ?? "",
    active: it.active,
    createdAt: it.createdAt,
    updatedAt: it.updatedAt,
   })),
  });
 } catch (e) {
  console.error(e);
  return jsonError("Server error", 500, e instanceof Error ? e.message : e);
 }
}

export async function POST(req: NextRequest) {
 const auth = requireAdmin(req);
 if (auth) return auth;

 try {
  const body = await req.json().catch(() => null);
  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success)
   return jsonError("Invalid body", 400, parsed.error.flatten());

  const { items } = await getCollections();
  const now = new Date();
  const requestedColor = normalizeHexColor(parsed.data.color ?? "");
  const existingColors = await items
   .find({}, { projection: { color: 1 } })
   .limit(1000)
   .toArray();
  const pickedColor =
   requestedColor ??
   pickUnusedPastelRandom(existingColors.map((d) => d.color ?? ""));
  const maxOrderDoc = await items
   .find({}, { projection: { sortOrder: 1 } })
   .sort({ sortOrder: -1 })
   .limit(1)
   .toArray();
  const maxOrder =
   typeof maxOrderDoc?.[0]?.sortOrder === "number" ? maxOrderDoc[0].sortOrder : 0;
  const nextOrder =
   typeof parsed.data.sortOrder === "number" ? parsed.data.sortOrder : maxOrder + 1;
  const doc = {
   name: parsed.data.name,
   description: parsed.data.description ?? "",
   capacity: parsed.data.capacity,
   sortOrder: nextOrder,
   color: pickedColor,
   autoCancelEnabled: Boolean(parsed.data.autoCancelEnabled),
   autoCancelMinBookings: parsed.data.autoCancelMinBookings ?? undefined,
   autoCancelCutoffHours: parsed.data.autoCancelCutoffHours ?? undefined,
   exclusiveKey: parsed.data.exclusiveKey?.trim() || "",
   active: parsed.data.active ?? true,
   createdAt: now,
   updatedAt: now,
  };
  const result = await items.insertOne(doc);
  return jsonOk({ itemId: result.insertedId.toHexString() });
 } catch (e) {
  return jsonError("Server error", 500, e instanceof Error ? e.message : e);
 }
}
