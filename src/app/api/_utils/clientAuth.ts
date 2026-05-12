import type { NextRequest } from "next/server";
import { CLIENT_COOKIE_NAME, verifyClientSessionValue } from "@/lib/clientSession";
import { jsonError } from "./http";

export function getClientIdFromRequest(req: NextRequest) {
  return verifyClientSessionValue(req.cookies.get(CLIENT_COOKIE_NAME)?.value);
}

export function requireClient(req: NextRequest) {
  const clientId = getClientIdFromRequest(req);
  if (!clientId) {
    return { clientId: null, response: jsonError("Client login required", 401) };
  }
  return { clientId, response: null };
}
