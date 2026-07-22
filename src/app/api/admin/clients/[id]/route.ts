import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { adminDeleteClientSchema, adminUpdateClientSchema } from "@/lib/schemas";
import { findClientsByWhatsapp } from "@/lib/clientMerge";
import { clientWhatsappFields } from "@/lib/whatsapp";
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
    if (!ObjectId.isValid(id)) return jsonError("Invalid client id", 400);
    const body = await req.json().catch(() => null);
    const parsed = adminUpdateClientSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const { clients } = await getCollections();
    const clientId = new ObjectId(id);
    const patch = { ...parsed.data } as Record<string, unknown>;

    if (typeof patch.whatsapp === "string") {
      const waFields = clientWhatsappFields(patch.whatsapp);
      if (waFields) {
        const matches = await findClientsByWhatsapp(clients, waFields.whatsapp);
        const other = matches.find((c) => !c._id.equals(clientId));
        if (other) {
          return jsonError(
            `This WhatsApp is already registered to ${other.name || "a client"} (${other.email}).`,
            409,
            {
              code: "whatsapp_taken",
              existingClient: {
                id: other._id.toHexString(),
                name: other.name,
                email: other.email,
                whatsapp: other.whatsapp,
              },
            },
          );
        }
        patch.whatsapp = waFields.whatsapp;
        patch.whatsappDigits = waFields.whatsappDigits;
        await clients.updateOne(
          { _id: clientId },
          { $set: { ...patch, updatedAt: new Date() } },
        );
        return jsonOk({ updated: true });
      }
      delete patch.whatsapp;
      await clients.updateOne(
        { _id: clientId },
        {
          $set: { ...patch, whatsapp: "", updatedAt: new Date() },
          $unset: { whatsappDigits: "" },
        },
      );
      return jsonOk({ updated: true });
    }

    await clients.updateOne(
      { _id: clientId },
      { $set: { ...patch, updatedAt: new Date() } },
    );
    return jsonOk({ updated: true });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) return jsonError("Invalid client id", 400);
    const body = await req.json().catch(() => ({}));
    const parsed = adminDeleteClientSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

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
