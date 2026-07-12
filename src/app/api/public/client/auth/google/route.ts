import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  attachOAuthReturnCookie,
  resolveOAuthReturnTo,
} from "@/lib/oauthReturn";

const STATE_COOKIE = "google_oauth_state";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const origin = new URL(req.url).origin;
  const returnOrigin = resolveOAuthReturnTo(
    req.nextUrl.searchParams.get("returnTo"),
  );
  const fail = (code: string) =>
    NextResponse.redirect(
      new URL(
        returnOrigin
          ? `/?authErr=${encodeURIComponent(code)}`
          : `/booking?authErr=${encodeURIComponent(code)}`,
        returnOrigin ?? origin,
      ),
    );

  if (!clientId) {
    return fail("google_unconfigured");
  }

  const redirectUri = `${origin}/api/public/client/auth/google/callback`;
  const state = crypto.randomBytes(24).toString("hex");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  const res = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return attachOAuthReturnCookie(res, returnOrigin);
}
