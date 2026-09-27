import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { clientAuthLookupSchema } from "@/lib/schemas";
import { findClientsByWhatsapp } from "@/lib/clientMerge";
import {
  getLoginRateLimit,
  loginRateLimitKeys,
} from "@/lib/authRateLimit";
import { jsonError, jsonOk } from "@/app/api/_utils/http";

/** Does this WhatsApp already have an account? Used to guide PIN enter vs set. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = clientAuthLookupSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const whatsapp = parsed.data.whatsapp;
    const { clients, authRateLimits } = await getCollections();
    const rateLimitKeys = loginRateLimitKeys(req, whatsapp);
    const rateLimit = await getLoginRateLimit(authRateLimits, rateLimitKeys);
    if (rateLimit.limited) {
      const response = jsonError(
        "Too many attempts. Please try again later.",
        429,
      );
      response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
      return response;
    }

    const matches = await findClientsByWhatsapp(clients, whatsapp);
    const exists = matches.length > 0;
    const hasPassword = matches.some((c) => Boolean(c.passwordHash));
    return jsonOk({ exists, hasPassword });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
