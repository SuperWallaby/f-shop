import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { pushPreferencesSchema } from "@/lib/schemas";
import { getCreditBalance, publicClient } from "@/lib/credits";
import { getClientIdFromRequest } from "@/app/api/_utils/clientAuth";
import { jsonError, jsonOk } from "@/app/api/_utils/http";

export async function PATCH(req: NextRequest) {
  const clientId = getClientIdFromRequest(req);
  if (!clientId) return jsonError("Client login required", 401);

  try {
    const body = await req.json().catch(() => null);
    const parsed = pushPreferencesSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const { clients, creditLedger } = await getCollections();
    const now = new Date();
    const r = await clients.updateOne(
      { _id: clientId },
      {
        $set: {
          pushMarketingOptIn: parsed.data.pushMarketingOptIn,
          updatedAt: now,
        },
      },
    );
    if (r.matchedCount === 0) return jsonError("Client not found", 404);

    const client = await clients.findOne({ _id: clientId });
    if (!client) return jsonError("Client not found", 404);
    const balance = await getCreditBalance({ creditLedger, clientId });
    return jsonOk({
      client: publicClient(client),
      balance,
      needsName: !(client.name ?? "").trim(),
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
