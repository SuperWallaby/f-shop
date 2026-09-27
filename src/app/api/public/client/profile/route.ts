import { NextRequest } from "next/server";
import { MongoServerError } from "mongodb";
import { getCollections } from "@/lib/db";
import { clientProfileSchema } from "@/lib/schemas";
import { getCreditBalance, makeCustomerKey, publicClient } from "@/lib/credits";
import { requireClientReady } from "@/app/api/_utils/clientAuth";
import { jsonError, jsonOk } from "@/app/api/_utils/http";
import { clientWhatsappFields } from "@/lib/whatsapp";
import { verifyPassword } from "@/lib/password";

function exactEmailRegex(email: string): RegExp {
  return new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

export async function PATCH(req: NextRequest) {
  const { clientId, response } = await requireClientReady(req);
  if (response || !clientId) return response;

  try {
    const body = await req.json().catch(() => null);
    const parsed = clientProfileSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid body", 400, parsed.error.flatten());

    const { clients, creditLedger, bookings } = await getCollections();
    const existing = await clients.findOne({ _id: clientId });
    if (!existing) return jsonError("Client not found", 404);

    const email = parsed.data.email?.trim().toLowerCase();
    const waFields = parsed.data.whatsapp
      ? clientWhatsappFields(parsed.data.whatsapp)
      : null;
    const phoneChanged =
      Boolean(waFields) && waFields!.whatsappDigits !== existing.whatsappDigits;
    if (email !== undefined) {
      const duplicateEmail = await clients.findOne({
        _id: { $ne: clientId },
        email: exactEmailRegex(email),
      });
      if (duplicateEmail) {
        return jsonError("This email is already registered.", 409, {
          code: "email_taken",
        });
      }
    }
    if (phoneChanged) {
      if (
        !parsed.data.currentPassword ||
        !existing.passwordHash ||
        !(await verifyPassword(parsed.data.currentPassword, existing.passwordHash))
      ) {
        return jsonError("Current PIN is required to change phone number.", 403);
      }
    }

    const now = new Date();
    const set = {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(email !== undefined && !existing.whatsappDigits
        ? { customerKey: makeCustomerKey({ email, whatsapp: existing.whatsapp }) }
        : {}),
      ...(waFields
        ? {
            whatsapp: waFields.whatsapp,
            whatsappDigits: waFields.whatsappDigits,
            customerKey: makeCustomerKey({
              email: email ?? existing.email,
              whatsapp: waFields.whatsapp,
            }),
          }
        : {}),
      updatedAt: now,
    };
    let r;
    try {
      r = await clients.updateOne({ _id: clientId }, { $set: set });
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000) {
        const message = String(e.message ?? "");
        if (
          message.includes("whatsappDigits") ||
          (message.includes("customerKey") && waFields)
        ) {
          return jsonError("This phone number is already registered.", 409, {
            code: "whatsapp_taken",
          });
        }
        return jsonError("This email is already registered.", 409, {
          code: "email_taken",
        });
      }
      throw e;
    }
    if (r.matchedCount === 0) return jsonError("Client not found", 404);

    const bookingContactSet = {
      ...(email !== undefined ? { email } : {}),
      ...(waFields ? { whatsapp: waFields.whatsapp } : {}),
    };
    if (Object.keys(bookingContactSet).length > 0) {
      await bookings.updateMany(
        { clientId, status: { $in: ["pending", "confirmed"] } },
        { $set: bookingContactSet },
      );
    }

    const client = await clients.findOne({ _id: clientId });
    if (!client) return jsonError("Client not found", 404);
    const balance = await getCreditBalance({ creditLedger, clientId });
    return jsonOk({
      client: publicClient(client),
      balance,
      needsName: !(client.name ?? "").trim(),
      needsPasswordChange: false,
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
