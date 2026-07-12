import * as jose from "jose";
import { MongoServerError, ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { getCreditBalance, makeCustomerKey, publicClient } from "@/lib/credits";

const GOOGLE_JWKS = jose.createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

/** OAuth client IDs that may appear as `aud` on Google ID tokens (web + mobile). */
export function googleOAuthAudiences(): string[] {
  const fromEnv = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
  ];
  const defaults = [
    "1087823396336-juu2k20ste2mr5m6cgmbis3otrv4ou86.apps.googleusercontent.com",
    "1087823396336-9rfo0uhv5rqgsuac9pbcd9sk9aujb21q.apps.googleusercontent.com",
    "1087823396336-6f6tqmktjauh7e6gng8urroi2l5mpk0p.apps.googleusercontent.com",
  ];
  return [...new Set([...fromEnv, ...defaults].filter(Boolean) as string[])];
}

export type GoogleIdTokenClaims = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
};

export async function verifyGoogleIdToken(
  idToken: string,
): Promise<GoogleIdTokenClaims> {
  const audiences = googleOAuthAudiences();
  if (audiences.length === 0) {
    throw new Error("google_unconfigured");
  }

  const { payload } = await jose.jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: audiences,
  });

  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const email = (
    typeof payload.email === "string" ? payload.email : ""
  )
    .trim()
    .toLowerCase();
  if (!sub || !email) {
    throw new Error("google_email");
  }
  if (payload.email_verified === false) {
    throw new Error("google_email");
  }

  return {
    sub,
    email,
    email_verified: payload.email_verified as boolean | undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
    given_name:
      typeof payload.given_name === "string" ? payload.given_name : undefined,
    family_name:
      typeof payload.family_name === "string" ? payload.family_name : undefined,
  };
}

export function googleDisplayName(claims: {
  name?: string;
  given_name?: string;
  family_name?: string;
  email: string;
}): string {
  return (
    (claims.name ?? "").trim() ||
    [claims.given_name, claims.family_name].filter(Boolean).join(" ").trim() ||
    claims.email.split("@")[0] ||
    "Member"
  );
}

export async function upsertClientFromGoogle(claims: GoogleIdTokenClaims) {
  const { clients } = await getCollections();
  const now = new Date();
  const email = claims.email;
  const displayName = googleDisplayName(claims);

  let client =
    (await clients.findOne({ googleSub: claims.sub })) ??
    (await clients.findOne({ email }));

  if (!client) {
    const customerKey = makeCustomerKey({ email });
    try {
      const ins = await clients.insertOne({
        customerKey,
        name: displayName,
        email,
        whatsapp: "",
        googleSub: claims.sub,
        studentStatus: "none" as const,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      });
      client = await clients.findOne({ _id: ins.insertedId });
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000) {
        client =
          (await clients.findOne({ email })) ??
          (await clients.findOne({ googleSub: claims.sub }));
      } else {
        throw e;
      }
    }
  }

  if (!client?._id) {
    throw new Error("google_account");
  }

  await clients.updateOne(
    { _id: client._id },
    {
      $set: {
        email,
        googleSub: claims.sub,
        lastLoginAt: now,
        updatedAt: now,
        ...(String(client.name ?? "").trim().length === 0
          ? { name: displayName }
          : {}),
      },
    },
  );

  const refreshed = await clients.findOne({ _id: client._id });
  if (!refreshed?._id) throw new Error("google_account");
  return refreshed._id;
}

export async function clientAuthPayload(clientId: ObjectId) {
  const { clients, creditLedger } = await getCollections();
  const client = await clients.findOne({ _id: clientId });
  if (!client) throw new Error("Client not found");
  const balance = await getCreditBalance({ creditLedger, clientId });
  return {
    client: publicClient(client),
    balance,
    needsName: !(client.name ?? "").trim(),
  };
}
