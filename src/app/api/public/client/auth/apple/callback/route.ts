import { NextRequest, NextResponse } from "next/server";
import { MongoServerError } from "mongodb";
import * as jose from "jose";
import { getCollections } from "@/lib/db";
import { makeCustomerKey } from "@/lib/credits";
import { setClientSessionCookie } from "@/lib/clientSession";
import { createAppleClientSecret } from "@/lib/appleClientSecret";

const STATE_COOKIE = "apple_oauth_state";

const APPLE_JWKS = jose.createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

type AppleUserPayload = {
  email?: string;
  name?: {
    firstName?: string;
    lastName?: string;
  };
};

function parseAppleUserParam(raw: string | null): AppleUserPayload | null {
  if (!raw) return null;
  const candidates = [raw, decodeURIComponent(raw)];
  for (const s of candidates) {
    try {
      return JSON.parse(s) as AppleUserPayload;
    } catch {
      // try next
    }
  }
  return null;
}

function incomingParams(req: NextRequest, form: Record<string, string>) {
  const url = new URL(req.url);
  const get = (k: string) => form[k] ?? url.searchParams.get(k) ?? "";
  return {
    code: get("code"),
    state: get("state"),
    userRaw: get("user") || null,
    error: get("error"),
  };
}

async function handleAppleCallback(req: NextRequest, form: Record<string, string>) {
  const origin = new URL(req.url).origin;
  const fail = (code: string) =>
    NextResponse.redirect(new URL(`/booking?authErr=${encodeURIComponent(code)}`, origin));

  const cookieState = req.cookies.get(STATE_COOKIE)?.value;
  const { code, state, userRaw, error } = incomingParams(req, form);

  if (error) return fail(`apple_${error}`);
  if (!cookieState || !state || cookieState !== state) return fail("apple_state");
  if (!code) return fail("apple_denied");

  const clientId = process.env.APPLE_CLIENT_ID!;
  const teamId = process.env.APPLE_TEAM_ID!;
  const keyId = process.env.APPLE_KEY_ID!;
  const privateKey = process.env.APPLE_PRIVATE_KEY;
  if (!clientId || !teamId || !keyId || !privateKey?.trim()) {
    return fail("apple_unconfigured");
  }

  const redirectUri = `${origin}/api/public/client/auth/apple/callback`;
  const clientSecret = await createAppleClientSecret({
    teamId,
    clientId,
    keyId,
    privateKeyPem: privateKey,
  });

  const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  const tokenJson = (await tokenRes.json()) as {
    id_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !tokenJson.id_token) {
    return fail(
      tokenJson.error === "invalid_client" ? "apple_invalid_client" : "apple_token",
    );
  }

  let payload: jose.JWTPayload;
  try {
    const verified = await jose.jwtVerify(tokenJson.id_token, APPLE_JWKS, {
      issuer: "https://appleid.apple.com",
      audience: clientId,
    });
    payload = verified.payload;
  } catch {
    return fail("apple_id_token");
  }

  const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
  if (!sub) return fail("apple_sub");

  const userBlob = parseAppleUserParam(userRaw || null);

  let email =
    typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email && userBlob?.email) email = userBlob.email.trim().toLowerCase();
  const nameFromApple =
    [userBlob?.name?.firstName, userBlob?.name?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || "";

  const displayNameFallback =
    nameFromApple ||
    (email ? email.split("@")[0]! : "") ||
    "Member";

  const { clients } = await getCollections();
  const now = new Date();

  let client = await clients.findOne({ appleSub: sub });
  if (!client && email) {
    client = await clients.findOne({ email });
  }
  if (client && !email) {
    email = (client.email ?? "").trim().toLowerCase();
  }

  const customerKey = email ? makeCustomerKey({ email }) : `apple:${sub}`;

  if (!client) {
    if (!email) {
      return fail("apple_email_required");
    }
    try {
      const ins = await clients.insertOne({
        customerKey,
        name: displayNameFallback,
        email,
        whatsapp: "",
        studentStatus: "none" as const,
        appleSub: sub,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      });
      client = await clients.findOne({ _id: ins.insertedId });
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000) {
        client =
          (await clients.findOne({ email })) ?? (await clients.findOne({ appleSub: sub }));
      } else {
        throw e;
      }
    }
  }

  if (!client) return fail("apple_account");

  await clients.updateOne(
    { _id: client._id },
    {
      $set: {
        ...(email ? { email } : {}),
        appleSub: sub,
        lastLoginAt: now,
        updatedAt: now,
        ...(!String(client.name ?? "").trim() ? { name: displayNameFallback } : {}),
      },
    },
  );

  const res = NextResponse.redirect(new URL("/booking", origin));
  res.cookies.delete(STATE_COOKIE);
  return setClientSessionCookie(res, client._id!);
}

export async function GET(req: NextRequest) {
  try {
    return await handleAppleCallback(req, {});
  } catch {
    const origin = new URL(req.url).origin;
    return NextResponse.redirect(new URL("/booking?authErr=apple_server", origin));
  }
}

/** Apple may POST (form_post) if response_mode changes in Developer settings. */
export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("application/x-www-form-urlencoded")) {
      const origin = new URL(req.url).origin;
      return NextResponse.redirect(
        new URL("/booking?authErr=apple_bad_request", origin),
      );
    }
    const txt = await req.text();
    const form: Record<string, string> = {};
    new URLSearchParams(txt).forEach((v, k) => {
      form[k] = v;
    });
    return await handleAppleCallback(req, form);
  } catch {
    const origin = new URL(req.url).origin;
    return NextResponse.redirect(new URL("/booking?authErr=apple_server", origin));
  }
}
