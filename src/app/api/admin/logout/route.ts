import { NextResponse } from "next/server";
import { jsonError } from "../../_utils/http";
import { clearAdminSessionCookie } from "@/lib/adminSession";

export async function POST() {
  try {
    const res = NextResponse.json({ ok: true, data: { authed: false } });
    clearAdminSessionCookie(res);
    return res;
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

