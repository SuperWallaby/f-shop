import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../../_utils/http";
import { requireAdmin } from "../../../_utils/adminAuth";
import { z } from "zod";
import { normalizeHexColor, pickUnusedPastelRandom } from "@/lib/itemColor";

const patchSchema = z
 .object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  capacity: z.number().int().min(1).max(1000).optional(),
  sortOrder: z.number().int().min(0).max(1000000).optional(),
  exclusiveKey: z.string().trim().max(64).optional(),
  color: z.string().trim().optional(),
  randomizeColor: z.boolean().optional(),
  autoCancelEnabled: z.boolean().optional(),
  autoCancelMinBookings: z.number().int().min(1).max(100).optional(),
  autoCancelCutoffHours: z.number().int().min(1).max(168).optional(),
  active: z.boolean().optional(),
 })
 .refine((v) => Object.keys(v).length > 0, { message: "Empty patch" });

export async function PATCH(
 req: NextRequest,
 ctx: { params: Promise<{ id: string }> }
) {
 const auth = requireAdmin(req);
 if (auth) return auth;

 try {
  const { id } = await ctx.params;
  const itemObjectId = ObjectId.isValid(id) ? new ObjectId(id) : null;
  if (!itemObjectId) return jsonError("Invalid item id", 400);

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
   return jsonError("Invalid body", 400, parsed.error.flatten());

  const { items } = await getCollections();
  const now = new Date();

  const set: Record<string, unknown> = { updatedAt: now };
  if (parsed.data.name !== undefined) set.name = parsed.data.name;
  if (parsed.data.description !== undefined)
   set.description = parsed.data.description;
  if (parsed.data.capacity !== undefined) set.capacity = parsed.data.capacity;
  if (parsed.data.sortOrder !== undefined) set.sortOrder = parsed.data.sortOrder;
  if (parsed.data.exclusiveKey !== undefined)
   set.exclusiveKey = parsed.data.exclusiveKey.trim();
  if (parsed.data.randomizeColor) {
   const current = await items.findOne(
    { _id: itemObjectId },
    { projection: { color: 1 } }
   );
   const otherColors = await items
    .find({ _id: { $ne: itemObjectId } }, { projection: { color: 1 } })
    .limit(1000)
    .toArray();
   set.color = pickUnusedPastelRandom(otherColors.map((d) => d.color ?? ""), {
    avoid: current?.color ?? "",
   });
  } else if (parsed.data.color !== undefined) {
   const normalized = normalizeHexColor(parsed.data.color);
   if (!normalized) return jsonError("Invalid color", 400);
   set.color = normalized;
  }
  if (parsed.data.autoCancelEnabled !== undefined)
   set.autoCancelEnabled = Boolean(parsed.data.autoCancelEnabled);
  if (parsed.data.autoCancelMinBookings !== undefined)
   set.autoCancelMinBookings = parsed.data.autoCancelMinBookings;
  if (parsed.data.autoCancelCutoffHours !== undefined)
   set.autoCancelCutoffHours = parsed.data.autoCancelCutoffHours;
  if (parsed.data.active !== undefined) set.active = parsed.data.active;

  const result = await items.updateOne({ _id: itemObjectId }, { $set: set });
  if (!result.matchedCount) return jsonError("Item not found", 404);

  const updated = await items.findOne({ _id: itemObjectId });
  return jsonOk({
   item: updated
    ? {
       id: updated._id!.toHexString(),
       name: updated.name,
       description: updated.description,
       capacity: updated.capacity,
      sortOrder: typeof updated.sortOrder === "number" ? updated.sortOrder : null,
       color: updated.color ?? "",
       autoCancelEnabled: Boolean(updated.autoCancelEnabled),
       autoCancelMinBookings: updated.autoCancelMinBookings ?? null,
       autoCancelCutoffHours: updated.autoCancelCutoffHours ?? null,
       exclusiveKey: updated.exclusiveKey ?? "",
       active: updated.active,
       createdAt: updated.createdAt,
       updatedAt: updated.updatedAt,
      }
    : null,
  });
 } catch (e) {
  return jsonError("Server error", 500, e instanceof Error ? e.message : e);
 }
}
