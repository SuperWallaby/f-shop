import { NextRequest } from "next/server";
import { MongoServerError } from "mongodb";
import { getCollections } from "@/lib/db";
import { clientAuthSignupSchema } from "@/lib/schemas";
import { getCreditBalance, makeCustomerKey, publicClient } from "@/lib/credits";
import { setClientSessionCookie } from "@/lib/clientSession";
import { hashPassword } from "@/lib/password";
import { normalizeWhatsapp } from "@/lib/whatsapp";
import { jsonError, jsonOk } from "@/app/api/_utils/http";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = clientAuthSignupSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const email = parsed.data.email.trim().toLowerCase();
    const nameTrim = (parsed.data.name ?? "").trim();
    const whatsappRaw = (parsed.data.whatsapp ?? "").trim();
    const whatsapp = whatsappRaw ? normalizeWhatsapp(whatsappRaw) : "";
    const passwordHash = await hashPassword(parsed.data.password);
    const now = new Date();

    const { clients, creditLedger } = await getCollections();
    const existing = await clients.findOne({ email });

    if (existing?.passwordHash) {
      return jsonError(
        "An account with this email already exists. Please sign in.",
        409,
      );
    }

    if (existing) {
      await clients.updateOne(
        { _id: existing._id },
        {
          $set: {
            passwordHash,
            ...(nameTrim ? { name: nameTrim } : {}),
            ...(whatsapp ? { whatsapp } : {}),
            updatedAt: now,
            lastLoginAt: now,
          },
        },
      );
      const refreshed = await clients.findOne({ _id: existing._id });
      if (!refreshed) return jsonError("Client not found", 404);
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

    try {
      const ins = await clients.insertOne({
        customerKey: makeCustomerKey({ email }),
        name: nameTrim,
        email,
        whatsapp,
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
