import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "../../_utils/http";
import { adminLoginSchema } from "@/lib/schemas";
import { requireEnv } from "@/lib/env";
import { setAdminSessionCookie } from "@/lib/adminSession";
import { getCollections } from "@/lib/db";
import {
  adminLoginRateLimitKeys,
  clearLoginFailures,
  getLoginRateLimit,
  recordLoginFailure,
} from "@/lib/authRateLimit";

function samePassword(got: string, expected: string): boolean {
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
 try {
  const body = await req.json().catch(() => null);
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
   return jsonError("Invalid body", 400, parsed.error.flatten());
  }

  let expected = "";
  try {
   expected = requireEnv("ADMIN_PASSWORD");
  } catch {
   return jsonError(
    "Admin password is not configured",
    500,
    "Set ADMIN_PASSWORD in your environment (.env.local)"
   );
  }

  const { authRateLimits } = await getCollections();
  const rateLimitKeys = adminLoginRateLimitKeys(req);
  const rateLimit = await getLoginRateLimit(authRateLimits, rateLimitKeys);
  if (rateLimit.limited) {
   const response = jsonError(
    "Too many attempts. Please wait a few minutes and try again.",
    429
   );
   response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
   return response;
  }

  if (!samePassword(parsed.data.password, expected)) {
   await recordLoginFailure(authRateLimits, rateLimitKeys);
   return jsonError("Invalid password", 401);
  }

  await clearLoginFailures(authRateLimits, rateLimitKeys);
  const res = NextResponse.json({ ok: true, data: { authed: true } });
  setAdminSessionCookie(res);
  return res;
 } catch (e) {
  return jsonError("Server error", 500, e instanceof Error ? e.message : e);
 }
}
