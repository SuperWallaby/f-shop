import { NextRequest, NextResponse } from "next/server";

import { isAllowedFlutterWebOrigin } from "@/lib/devPorts";

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  if (!isAllowedFlutterWebOrigin(origin)) {
    return NextResponse.next();
  }

  const corsHeaders: HeadersInit = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
