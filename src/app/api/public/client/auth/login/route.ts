import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { getCreditBalance, publicClient } from "@/lib/credits";
import { findClientsByWhatsapp, pickPrimaryClient } from "@/lib/clientMerge";
import { setClientSessionCookie } from "@/lib/clientSession";
import { verifyPassword } from "@/lib/password";
import { jsonError, jsonOk } from "@/app/api/_utils/http";

/** Sign in with the mobile phone + PIN flow while retaining legacy email login. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const password = typeof body?.password === "string" ? body.password : "";
    const whatsapp = typeof body?.whatsapp === "string" ? body.whatsapp : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!/^\d{4}$/.test(password) || (!whatsapp && !email)) {
      return jsonError("Invalid body", 400);
    }

    const { clients, creditLedger } = await getCollections();
    const phoneMatches = whatsapp ? await findClientsByWhatsapp(clients, whatsapp) : [];
    const client = phoneMatches.length
      ? pickPrimaryClient(phoneMatches)
      : email
        ? await clients.findOne({ email })
        : null;

    if (!client?.passwordHash) {
      return jsonError("Invalid phone number or PIN.", 401);
    }

    const ok = await verifyPassword(password, client.passwordHash);
    if (!ok) return jsonError("Invalid phone number or PIN.", 401);

    const now = new Date();
    await clients.updateOne(
      { _id: client._id },
      { $set: { lastLoginAt: now, updatedAt: now } },
    );
    const refreshed = await clients.findOne({ _id: client._id });
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
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
