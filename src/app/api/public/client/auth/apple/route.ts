import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  attachOAuthReturnCookie,
  resolveOAuthReturnTo,
} from "@/lib/oauthReturn";

const STATE_COOKIE = "apple_oauth_state";

export async function GET(req: NextRequest) {
  const clientId = process.env.APPLE_CLIENT_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY;
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

  if (!clientId || !teamId || !keyId || !privateKey?.trim()) {
    return fail("apple_unconfigured");
  }

  const redirectUri = `${origin}/api/public/client/auth/apple/callback`;
  const state = crypto.randomBytes(24).toString("hex");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "name email",
    state,
    response_mode: "query",
  });

  const res = NextResponse.redirect(
    `https://appleid.apple.com/auth/authorize?${params.toString()}`,
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
