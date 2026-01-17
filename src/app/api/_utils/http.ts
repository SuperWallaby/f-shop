import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(
  message: string,
  status: number,
  details?: unknown
): NextResponse {
  return NextResponse.json({ ok: false, error: { message, details } }, { status });
}

