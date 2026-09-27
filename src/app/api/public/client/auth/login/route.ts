import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { clientAuthPasswordLoginSchema } from "@/lib/schemas";
import { getCreditBalance, publicClient } from "@/lib/credits";
import { findClientsByWhatsapp, pickPrimaryClient } from "@/lib/clientMerge";
import { setClientSessionCookie } from "@/lib/clientSession";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  clearLoginFailures,
  getLoginRateLimit,
  loginRateLimitKeys,
  recordLoginFailure,
} from "@/lib/authRateLimit";
import { jsonError, jsonOk } from "@/app/api/_utils/http";

const DUMMY_PASSWORD_HASH = hashPassword("0000");

/** Sign in with WhatsApp (primary identity) + 4-digit password. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = clientAuthPasswordLoginSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const whatsapp = parsed.data.whatsapp;
    const { clients, creditLedger, authRateLimits } = await getCollections();
    const rateLimitKeys = loginRateLimitKeys(req, whatsapp);
    const rateLimit = await getLoginRateLimit(authRateLimits, rateLimitKeys);
    if (rateLimit.limited) {
      const response = jsonError(
        "Too many sign-in attempts. Please try again later.",
        429,
      );
      response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
      return response;
    }

    const matches = await findClientsByWhatsapp(clients, whatsapp);
    if (!matches.length) {
      await verifyPassword(parsed.data.password, await DUMMY_PASSWORD_HASH);
      await recordLoginFailure(authRateLimits, rateLimitKeys);
      return jsonError("Invalid phone number or password.", 401);
    }

    const client = pickPrimaryClient(matches);
    if (!client.passwordHash) {
      await verifyPassword(parsed.data.password, await DUMMY_PASSWORD_HASH);
      await recordLoginFailure(authRateLimits, rateLimitKeys);
      return jsonError("Invalid phone number or password.", 401);
    }

    const ok = await verifyPassword(parsed.data.password, client.passwordHash);
    if (!ok) {
      await recordLoginFailure(authRateLimits, rateLimitKeys);
      return jsonError("Invalid phone number or password.", 401);
    }

    const now = new Date();
    // Clear the account-specific counter after success. Keep the IP counter so
    // an attacker cannot reset it by signing into a separate known account.
    await clearLoginFailures(authRateLimits, rateLimitKeys.slice(0, 1));
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
    const res = jsonOk({
      client: publicClient(refreshed),
      balance,
      needsName: !(refreshed.name ?? "").trim(),
      needsPasswordChange: Boolean(refreshed.mustChangePassword),
    });
    return setClientSessionCookie(res, refreshed._id!, req);
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
