import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireEnv } from "./env";

export const ADMIN_COOKIE_NAME = "admin_session";

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

export function createAdminSessionValue(): string {
 const secret = requireEnv("ADMIN_SESSION_SECRET");
 const payload = JSON.stringify({ iat: Date.now() });
 const payloadB64 = b64url(payload);
 const sig = hmacSha256(payloadB64, secret);
 return `${payloadB64}.${sig}`;
}

export function verifyAdminSessionValue(value: string | undefined): boolean {
 if (!value) return false;
 const secret = process.env.ADMIN_SESSION_SECRET;
 if (!secret) return false;

 const [payloadB64, sig] = value.split(".");
 if (!payloadB64 || !sig) return false;

 const expected = hmacSha256(payloadB64, secret);
 if (sig.length !== expected.length) return false;
 const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
 if (!ok) return false;

 try {
  const payloadStr = b64urlDecodeToString(payloadB64);
  const payload = JSON.parse(payloadStr) as { iat?: number };
  if (!payload.iat || typeof payload.iat !== "number") return false;
  // Optional: expire sessions after 7 days
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - payload.iat > maxAgeMs) return false;
  return true;
 } catch {
  return false;
 }
}

export function requireAdminOrThrow(): void {
 throw new Error(
  "requireAdminOrThrow is deprecated; use requireAdmin(req) helper in API routes."
 );
}

export function setAdminSessionCookie(res: NextResponse): NextResponse {
 const value = createAdminSessionValue();
 res.cookies.set(ADMIN_COOKIE_NAME, value, {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
 });
 return res;
}

export function clearAdminSessionCookie(res: NextResponse): NextResponse {
 res.cookies.set(ADMIN_COOKIE_NAME, "", {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 0,
 });
 return res;
}
