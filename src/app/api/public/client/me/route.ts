import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { clearClientSessionCookie } from "@/lib/clientSession";
import { getCreditBalance, publicClient } from "@/lib/credits";
import { getClientIdFromRequest } from "@/app/api/_utils/clientAuth";
import { jsonOk } from "@/app/api/_utils/http";

export async function GET(req: NextRequest) {
  const clientId = getClientIdFromRequest(req);
  if (!clientId) return jsonOk({ authed: false });

  const { clients, creditLedger } = await getCollections();
  const client = await clients.findOne({ _id: clientId });
  if (!client) {
    const res = jsonOk({ authed: false });
    return clearClientSessionCookie(res);
  }
  const balance = await getCreditBalance({ creditLedger, clientId });
  const needsName = !(client.name ?? "").trim();
  return jsonOk({
    authed: true,
    client: publicClient(client),
    balance,
    needsName,
  });
}
