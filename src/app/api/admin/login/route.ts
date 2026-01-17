import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "../../_utils/http";
import { adminLoginSchema } from "@/lib/schemas";
import { requireEnv } from "@/lib/env";
import { setAdminSessionCookie } from "@/lib/adminSession";

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

  const passwordMatch = parsed.data.password === expected;

  if (!passwordMatch) {
   return jsonError("Invalid password", 401);
  }

  const res = NextResponse.json({ ok: true, data: { authed: true } });
  setAdminSessionCookie(res);
  return res;
 } catch (e) {
  return jsonError("Server error", 500, e instanceof Error ? e.message : e);
 }
}
