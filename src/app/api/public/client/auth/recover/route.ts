import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { clientAuthRecoverSchema } from "@/lib/schemas";
import { getCreditBalance, publicClient } from "@/lib/credits";
import { normalizeWhatsapp } from "@/lib/whatsapp";
import { setClientSessionCookie } from "@/lib/clientSession";
import { jsonError, jsonOk } from "@/app/api/_utils/http";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = clientAuthRecoverSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid body", 400, parsed.error.flatten());

    const { clients, creditLedger } = await getCollections();
    const now = new Date();
    const nameTrim = parsed.data.name.trim();
    const wa = normalizeWhatsapp(parsed.data.whatsapp);

    const matches = await clients
      .find({
        whatsapp: wa,
        name: new RegExp(`^${escapeRegExp(nameTrim)}$`, "i"),
      })
      .limit(5)
      .toArray();

    if (matches.length === 0) {
      return jsonError("No account matches that name and phone number.", 404);
    }
    if (matches.length > 1) {
      return jsonError("Multiple accounts match. Please contact the studio.", 400);
    }

    const client = matches[0]!;
    await clients.updateOne(
      { _id: client._id },
      { $set: { lastLoginAt: now, updatedAt: now } },
    );
    const fresh = await clients.findOne({ _id: client._id });
    if (!fresh) return jsonError("Client not found", 404);

    const balance = await getCreditBalance({ creditLedger, clientId: fresh._id! });
    const res = jsonOk({
      client: publicClient(fresh),
      balance,
    });
    return setClientSessionCookie(res, fresh._id!);
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
