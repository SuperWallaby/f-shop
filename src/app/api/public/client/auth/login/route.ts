import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { clientAuthPasswordLoginSchema } from "@/lib/schemas";
import { getCreditBalance, publicClient } from "@/lib/credits";
import { setClientSessionCookie } from "@/lib/clientSession";
import { verifyPassword } from "@/lib/password";
import { jsonError, jsonOk } from "@/app/api/_utils/http";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = clientAuthPasswordLoginSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const email = parsed.data.email.trim().toLowerCase();
    const { clients, creditLedger } = await getCollections();
    const client = await clients.findOne({ email });

    if (!client?.passwordHash) {
      return jsonError("Invalid email or password.", 401);
    }

    const ok = await verifyPassword(parsed.data.password, client.passwordHash);
    if (!ok) {
      return jsonError("Invalid email or password.", 401);
    }

    const now = new Date();
    await clients.updateOne(
      { _id: client._id },
      { $set: { lastLoginAt: now, updatedAt: now } },
    );
    const refreshed = await clients.findOne({ _id: client._id });
    if (!refreshed) return jsonError("Client not found", 404);

    const balance = await getCreditBalance({
      creditLedger,
      clientId: refreshed._id!,
    });
    const res = jsonOk({
      client: publicClient(refreshed),
      balance,
      needsName: !(refreshed.name ?? "").trim(),
    });
    return setClientSessionCookie(res, refreshed._id!, req);
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
