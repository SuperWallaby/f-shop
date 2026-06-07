import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { adminDeleteClientSchema, adminUpdateClientSchema } from "@/lib/schemas";
import { requireAdmin } from "../../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../../_utils/http";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) return jsonError("Invalid client id", 400);
    const body = await req.json().catch(() => null);
    const parsed = adminUpdateClientSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid body", 400, parsed.error.flatten());

    const { clients } = await getCollections();
    await clients.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...parsed.data, updatedAt: new Date() } },
    );
    return jsonOk({ updated: true });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) return jsonError("Invalid client id", 400);
    const body = await req.json().catch(() => ({}));
    const parsed = adminDeleteClientSchema.safeParse(body ?? {});
    if (!parsed.success) return jsonError("Invalid body", 400, parsed.error.flatten());

    const clientId = new ObjectId(id);
    const { clients, creditLedger, orders, bookings } = await getCollections();
    const client = await clients.findOne({ _id: clientId });
    if (!client) return jsonError("Client not found", 404);

    const typed = parsed.data.confirmEmail.trim().toLowerCase();
    if (typed !== client.email.trim().toLowerCase()) {
      return jsonError("Confirmation email does not match this client", 400);
    }

    await creditLedger.deleteMany({ clientId });
    await orders.deleteMany({ clientId });
    await bookings.updateMany({ clientId }, { $unset: { clientId: "" } });
    await clients.deleteOne({ _id: clientId });

    return jsonOk({ deleted: true });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
