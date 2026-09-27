import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { clientChangePasswordSchema } from "@/lib/schemas";
import { getCreditBalance, publicClient } from "@/lib/credits";
import { getClientIdFromRequest } from "@/app/api/_utils/clientAuth";
import { hashPassword } from "@/lib/password";
import { jsonError, jsonOk } from "@/app/api/_utils/http";

/** Set a new 4-digit password (required after temp PIN reset). */
export async function POST(req: NextRequest) {
  const clientId = getClientIdFromRequest(req);
  if (!clientId) return jsonError("Client login required", 401);

  try {
    const body = await req.json().catch(() => null);
    const parsed = clientChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const { clients, creditLedger } = await getCollections();
    const client = await clients.findOne({ _id: clientId });
    if (!client) return jsonError("Client not found", 404);

    const passwordHash = await hashPassword(parsed.data.password);
    const now = new Date();
    await clients.updateOne(
      { _id: clientId },
      {
        $set: {
          passwordHash,
          mustChangePassword: false,
          updatedAt: now,
        },
        $unset: { passwordResetSentAt: "", passwordResetToken: "" },
      },
    );

    const refreshed = await clients.findOne({ _id: clientId });
    if (!refreshed) return jsonError("Client not found", 404);
    const balance = await getCreditBalance({ creditLedger, clientId });
    return jsonOk({
      client: publicClient(refreshed),
      balance,
      needsName: !(refreshed.name ?? "").trim(),
      needsPasswordChange: false,
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
