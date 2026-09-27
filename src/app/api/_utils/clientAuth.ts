import type { NextRequest } from "next/server";
import { CLIENT_COOKIE_NAME, verifyClientSessionValue } from "@/lib/clientSession";
import { getCollections } from "@/lib/db";
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

export async function requireClientReady(req: NextRequest) {
  const auth = requireClient(req);
  if (auth.response || !auth.clientId) return auth;
  const { clients } = await getCollections();
  const client = await clients.findOne({ _id: auth.clientId });
  if (!client) {
    return {
      clientId: null,
      response: jsonError("Client login required", 401),
    };
  }
  if (client.mustChangePassword) {
    return {
      clientId: null,
      response: jsonError(
        "Set a new 4-digit PIN before continuing.",
        403,
        { code: "password_change_required" },
      ),
    };
  }
  return { clientId: auth.clientId, response: null };
}

/** Blocks an authenticated reset session while preserving guest access. */
export async function guardClientAccessIfAuthenticated(req: NextRequest) {
  const clientId = getClientIdFromRequest(req);
  if (!clientId) return null;
  const { clients } = await getCollections();
  const client = await clients.findOne(
    { _id: clientId },
    { projection: { mustChangePassword: 1 } },
  );
  if (!client?.mustChangePassword) return null;
  return jsonError(
    "Set a new 4-digit PIN before continuing.",
    403,
    { code: "password_change_required" },
  );
}
