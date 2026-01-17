import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSessionValue } from "@/lib/adminSession";
import { jsonError } from "./http";

export function requireAdmin(req: NextRequest) {
  const value = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const verified = verifyAdminSessionValue(value);

  if (!verified) {
    return jsonError("Unauthorized", 401);
  }
  return null;
}

