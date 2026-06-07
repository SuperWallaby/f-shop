import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { adminExpiryApprovalSchema } from "@/lib/schemas";
import { requireAdmin } from "../../../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../../../_utils/http";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) return jsonError("Invalid client id", 400);
    const clientId = new ObjectId(id);
    const body = await req.json().catch(() => ({}));
    const parsed = adminExpiryApprovalSchema.safeParse(body ?? {});
    if (!parsed.success) return jsonError("Invalid body", 400, parsed.error.flatten());

    const rawIds = parsed.data.ledgerIds.filter((x) => ObjectId.isValid(x));
    const hexUnique = [...new Set(rawIds)];
    const ids = hexUnique.map((x) => new ObjectId(x));
    if (ids.length === 0) return jsonError("Invalid ledger ids", 400);

    const { clients, creditLedger } = await getCollections();
    const client = await clients.findOne({ _id: clientId });
    if (!client) return jsonError("Client not found", 404);

    const rows = await creditLedger
      .find({
        _id: { $in: ids },
        clientId,
        amount: { $gt: 0 },
        expiresAt: { $exists: true },
      })
      .toArray();

    if (rows.length !== ids.length) {
      return jsonError("Some ledger rows are missing, not credits, or lack an expiry date", 400);
    }

    await creditLedger.updateMany(
      { _id: { $in: ids }, clientId },
      { $set: { expiryApproved: parsed.data.approved } },
    );

    return jsonOk({ updated: true });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
