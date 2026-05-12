import { NextRequest, NextResponse } from "next/server";
import { MongoServerError } from "mongodb";
import { getCollections } from "@/lib/db";
import { makeCustomerKey } from "@/lib/credits";
import { setClientSessionCookie } from "@/lib/clientSession";

const STATE_COOKIE = "google_oauth_state";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

type GoogleUserInfo = {
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
};

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const fail = (code: string) => NextResponse.redirect(new URL(`/booking?authErr=${encodeURIComponent(code)}`, origin));

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
  if (!email || !userRes.ok) {
    return fail("google_email");
  }

  const displayName =
    (user.name ?? "").trim() ||
    [user.given_name, user.family_name].filter(Boolean).join(" ").trim() ||
    email.split("@")[0] ||
    "Member";

  const { clients } = await getCollections();
  const now = new Date();
  let client = await clients.findOne({ email });

  if (!client) {
    const customerKey = makeCustomerKey({ email });
    try {
      const ins = await clients.insertOne({
        customerKey,
        name: displayName,
        email,
        whatsapp: "",
        studentStatus: "none" as const,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      });
      client = await clients.findOne({ _id: ins.insertedId });
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000) {
        client = await clients.findOne({ email });
      } else {
        throw e;
      }
    }
  }

  if (!client) return fail("google_account");

  await clients.updateOne(
   { _id: client._id },
   {
    $set: {
     email,
     lastLoginAt: now,
     updatedAt: now,
     ...(String(client.name ?? "").trim().length === 0 ? { name: displayName } : {}),
    },
   },
  );

  const res = NextResponse.redirect(new URL("/booking", origin));
  res.cookies.delete(STATE_COOKIE);
  return setClientSessionCookie(res, client._id!);
}
