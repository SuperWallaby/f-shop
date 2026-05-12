import crypto from "crypto";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
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

const CLIENT_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 400; // ~400 days; no server-side token expiry

export function setClientSessionCookie(res: NextResponse, clientId: ObjectId): NextResponse {
  res.cookies.set(CLIENT_COOKIE_NAME, createClientSessionValue(clientId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CLIENT_SESSION_MAX_AGE_SEC,
  });
  return res;
}

export function clearClientSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(CLIENT_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
