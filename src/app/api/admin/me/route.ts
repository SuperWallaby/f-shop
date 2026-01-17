import { NextRequest } from "next/server";
import { jsonOk } from "../../_utils/http";
import { ADMIN_COOKIE_NAME, verifyAdminSessionValue } from "@/lib/adminSession";

export async function GET(req: NextRequest) {
  const value = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const authed = verifyAdminSessionValue(value);
  return jsonOk({ authed });
}

