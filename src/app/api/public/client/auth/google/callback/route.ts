import { NextRequest, NextResponse } from "next/server";
import { upsertClientFromGoogle } from "@/lib/googleClientAuth";
import { setClientSessionCookie } from "@/lib/clientSession";
import {
  clearOAuthReturnCookie,
  oauthFailRedirect,
  oauthSuccessRedirect,
  readOAuthReturnTo,
} from "@/lib/oauthReturn";

const STATE_COOKIE = "google_oauth_state";

type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
  error?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
};

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const returnOrigin = readOAuthReturnTo(req);
  const fail = (code: string) => {
    const res = NextResponse.redirect(
      oauthFailRedirect(origin, code, returnOrigin),
    );
    res.cookies.delete(STATE_COOKIE);
    clearOAuthReturnCookie(res);
    return res;
  };

  const cookieState = req.cookies.get(STATE_COOKIE)?.value;
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!cookieState || !state || cookieState !== state) {
    return fail("google_state");
  }
  if (!code) {
    const err = url.searchParams.get("error");
    return fail(err ? `google_${err}` : "google_denied");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return fail("google_unconfigured");
  }

  const redirectUri = `${origin}/api/public/client/auth/google/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokenJson = (await tokenRes.json()) as GoogleTokenResponse;
  if (!tokenRes.ok || !tokenJson.access_token) {
    return fail("google_token");
  }

  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const user = (await userRes.json()) as GoogleUserInfo;
  const email = (user.email ?? "").trim().toLowerCase();
  const sub = (user.sub ?? "").trim();
  if (!email || !sub || !userRes.ok) {
    return fail("google_email");
  }

  try {
    const clientObjectId = await upsertClientFromGoogle({
      sub,
      email,
      name: user.name,
      given_name: user.given_name,
      family_name: user.family_name,
    });

    const res = NextResponse.redirect(
      oauthSuccessRedirect(origin, returnOrigin),
    );
    res.cookies.delete(STATE_COOKIE);
    clearOAuthReturnCookie(res);
    return setClientSessionCookie(res, clientObjectId, req, {
      crossOrigin: Boolean(returnOrigin),
    });
  } catch {
    return fail("google_account");
  }
}
