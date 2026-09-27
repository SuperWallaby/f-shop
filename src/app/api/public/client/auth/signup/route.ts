import { NextRequest } from "next/server";
import { MongoServerError } from "mongodb";
import { getCollections } from "@/lib/db";
import { clientAuthSignupSchema } from "@/lib/schemas";
import { getCreditBalance, makeCustomerKey, publicClient } from "@/lib/credits";
import { findClientsByWhatsapp, pickPrimaryClient } from "@/lib/clientMerge";
import { setClientSessionCookie } from "@/lib/clientSession";
import { hashPassword } from "@/lib/password";
import { clientWhatsappFields } from "@/lib/whatsapp";
import { jsonError, jsonOk } from "@/app/api/_utils/http";

function exactEmailRegex(email: string): RegExp {
  return new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

/**
 * Create / complete account: WhatsApp is primary identity.
 * Phone + 4-digit PIN. Email/name optional (collected later if missing).
 * Guest/legacy rows without a PIN can set one here (same UX as new signup).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = clientAuthSignupSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const email = parsed.data.email?.trim().toLowerCase();
    const nameTrim = parsed.data.name?.trim() ?? "";
    const waFields = clientWhatsappFields(parsed.data.whatsapp);
    if (!waFields) {
      return jsonError("Valid WhatsApp / phone number is required", 400);
    }
    const whatsapp = waFields.whatsapp;
    const passwordHash = await hashPassword(parsed.data.password);
    const now = new Date();

    const { clients, creditLedger } = await getCollections();

    const waMatches = await findClientsByWhatsapp(clients, whatsapp);
    const byPhone = waMatches.length ? pickPrimaryClient(waMatches) : null;

    // Existing account already has a PIN — must sign in / find password.
    if (byPhone?.passwordHash) {
      return jsonError(
        "This phone number already has an account. Please sign in or use Find password.",
        409,
        { code: "whatsapp_taken" },
      );
    }

    // Guest / admin-created row with no PIN: attach PIN and continue (like signup).
    if (byPhone && !byPhone.passwordHash) {
      await clients.updateOne(
        { _id: byPhone._id },
        {
          $set: {
            passwordHash,
            whatsapp,
            whatsappDigits: waFields.whatsappDigits,
            updatedAt: now,
            lastLoginAt: now,
            ...(nameTrim && !(byPhone.name ?? "").trim() ? { name: nameTrim } : {}),
            ...(email && !(byPhone.email ?? "").trim() ? { email } : {}),
          },
        },
      );
      const refreshed = await clients.findOne({ _id: byPhone._id });
      if (!refreshed) return jsonError("Could not update account", 500);
      const balance = await getCreditBalance({
        creditLedger,
        clientId: refreshed._id!,
      });
      return setClientSessionCookie(
        jsonOk({
          client: publicClient(refreshed),
          balance,
          needsName: !(refreshed.name ?? "").trim(),
        }),
        refreshed._id!,
        req,
      );
    }

    const byEmail = email
      ? await clients.findOne({ email: exactEmailRegex(email) })
      : null;
    if (byEmail) {
      return jsonError(
        "This email is already registered to another phone number.",
        409,
        { code: "email_taken" },
      );
    }

    try {
      const ins = await clients.insertOne({
        customerKey: makeCustomerKey({ email, whatsapp }),
        name: nameTrim,
        ...(email ? { email } : {}),
        whatsapp,
        whatsappDigits: waFields.whatsappDigits,
        passwordHash,
        studentStatus: "none" as const,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      });

      const created = await clients.findOne({ _id: ins.insertedId });
      if (!created) return jsonError("Could not create account", 500);
      const balance = await getCreditBalance({
        creditLedger,
        clientId: created._id!,
      });
      return setClientSessionCookie(
        jsonOk({
          client: publicClient(created),
          balance,
          needsName: !(created.name ?? "").trim(),
        }),
        created._id!,
        req,
      );
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000) {
        const msg = String(e.message ?? "");
        if (msg.includes("whatsappDigits")) {
          return jsonError(
            "This phone number is already registered. Please sign in.",
            409,
            { code: "whatsapp_taken" },
          );
        }
        return jsonError(
          "An account with this email already exists. Please sign in.",
          409,
        );
      }
      throw e;
    }
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
