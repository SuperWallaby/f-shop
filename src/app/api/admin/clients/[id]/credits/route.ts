import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { adminAdjustCreditSchema } from "@/lib/schemas";
import { requireAdmin } from "../../../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../../../_utils/http";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) return jsonError("Invalid client id", 400);
    const body = await req.json().catch(() => null);
    const parsed = adminAdjustCreditSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid body", 400, parsed.error.flatten());

    const { clients, creditLedger } = await getCollections();
    const clientId = new ObjectId(id);
    const client = await clients.findOne({ _id: clientId });
    if (!client) return jsonError("Client not found", 404);

    await creditLedger.insertOne({
      clientId,
      type: "admin_adjust",
      amount: parsed.data.amount,
      ...(parsed.data.expiresAt ? { expiresAt: new Date(parsed.data.expiresAt) } : {}),
      note: parsed.data.note,
      createdAt: new Date(),
    });

    return jsonOk({ adjusted: true });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
