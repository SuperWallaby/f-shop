import type { NextRequest, NextResponse } from "next/server";
import { resolveAllowedFlutterWebOrigin } from "@/lib/devPorts";

export const OAUTH_RETURN_COOKIE = "fasea_oauth_return";

export function resolveOAuthReturnTo(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return resolveAllowedFlutterWebOrigin(raw.trim());
}

export function readOAuthReturnTo(req: NextRequest): string | null {
  const fromCookie = req.cookies.get(OAUTH_RETURN_COOKIE)?.value;
  if (fromCookie) return resolveOAuthReturnTo(fromCookie);
  return resolveOAuthReturnTo(req.nextUrl.searchParams.get("returnTo"));
}

export function oauthFailRedirect(
  apiOrigin: string,
  code: string,
  returnOrigin: string | null,
): URL {
  if (returnOrigin) {
    return new URL(`/?authErr=${encodeURIComponent(code)}`, returnOrigin);
  }
  return new URL(`/booking?authErr=${encodeURIComponent(code)}`, apiOrigin);
}

export function oauthSuccessRedirect(
  apiOrigin: string,
  returnOrigin: string | null,
): URL {
  if (returnOrigin) {
    return new URL("/?authOk=1", returnOrigin);
  }
  return new URL("/booking", apiOrigin);
}

export function attachOAuthReturnCookie(
  res: NextResponse,
  returnOrigin: string | null,
): NextResponse {
  if (!returnOrigin) return res;
  res.cookies.set(OAUTH_RETURN_COOKIE, returnOrigin, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}

export function clearOAuthReturnCookie(res: NextResponse): NextResponse {
  res.cookies.delete(OAUTH_RETURN_COOKIE);
  return res;
}
