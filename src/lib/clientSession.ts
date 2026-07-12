import crypto from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { isAllowedFlutterWebOrigin } from "@/lib/devPorts";
import { optionalEnv, requireEnv } from "./env";

export const CLIENT_COOKIE_NAME = "client_session";

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function b64urlDecodeToString(input: string): string {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replaceAll("-", "+").replaceAll("_", "/") + pad;
  return Buffer.from(b64, "base64").toString("utf8");
}

function hmacSha256(data: string, secret: string): string {
  return b64url(crypto.createHmac("sha256", secret).update(data).digest());
}

function getSecret() {
  return optionalEnv("CLIENT_SESSION_SECRET") ?? requireEnv("ADMIN_SESSION_SECRET");
}

export function createClientSessionValue(clientId: ObjectId): string {
  const payload = JSON.stringify({
    clientId: clientId.toHexString(),
    iat: Date.now(),
  });
  const payloadB64 = b64url(payload);
  const sig = hmacSha256(payloadB64, getSecret());
  return `${payloadB64}.${sig}`;
}

export function verifyClientSessionValue(value: string | undefined): ObjectId | null {
  if (!value) return null;
  const secret = optionalEnv("CLIENT_SESSION_SECRET") ?? process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;
  const [payloadB64, sig] = value.split(".");
  if (!payloadB64 || !sig) return null;
  const expected = hmacSha256(payloadB64, secret);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(b64urlDecodeToString(payloadB64)) as {
      clientId?: string;
      iat?: number;
    };
    if (!payload.iat || typeof payload.iat !== "number") return null;
    if (!payload.clientId || !ObjectId.isValid(payload.clientId)) return null;
    return new ObjectId(payload.clientId);
  } catch {
    return null;
  }
}

const CLIENT_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 730; // ~2 years; sliding refresh on /me

type SessionCookieOpts = {
  /** OAuth callback returning to Flutter web (no Origin header on redirect). */
  crossOrigin?: boolean;
};

export function usesCrossOriginClientSession(
  req?: NextRequest,
  opts?: SessionCookieOpts,
): boolean {
  if (opts?.crossOrigin) return true;
  if (!req) return false;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const apiOrigin = new URL(req.url).origin;
    if (origin === apiOrigin) return false;
    return isAllowedFlutterWebOrigin(origin);
  } catch {
    return false;
  }
}

function sessionCookieAttributes(req?: NextRequest, opts?: SessionCookieOpts) {
  const crossOrigin = usesCrossOriginClientSession(req, opts);
  return {
    httpOnly: true,
    path: "/",
    sameSite: (crossOrigin ? "none" : "lax") as "lax" | "none",
    secure: crossOrigin || process.env.NODE_ENV === "production",
  };
}

export function setClientSessionCookie(
  res: NextResponse,
  clientId: ObjectId,
  req?: NextRequest,
  opts?: SessionCookieOpts,
): NextResponse {
  const maxAge = CLIENT_SESSION_MAX_AGE_SEC;
  res.cookies.set(CLIENT_COOKIE_NAME, createClientSessionValue(clientId), {
    ...sessionCookieAttributes(req, opts),
    maxAge,
    expires: new Date(Date.now() + maxAge * 1000),
  });
  return res;
}

export function clearClientSessionCookie(
  res: NextResponse,
  req?: NextRequest,
  opts?: SessionCookieOpts,
): NextResponse {
  res.cookies.set(CLIENT_COOKIE_NAME, "", {
    ...sessionCookieAttributes(req, opts),
    maxAge: 0,
  });
  return res;
}
