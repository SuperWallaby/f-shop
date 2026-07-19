import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { serializeCashTransaction } from "@/lib/cashTransactions";
import { requireAdmin } from "../../../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../../../_utils/http";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) return jsonError("Invalid transaction id", 400);

    const { cashTransactions } = await getCollections();
    const txnId = new ObjectId(id);
    const txn = await cashTransactions.findOne({ _id: txnId });
    if (!txn) return jsonError("Transaction not found", 404);
    if (txn.status === "voided") {
      return jsonOk({
        transaction: serializeCashTransaction(txn),
        alreadyVoided: true,
      });
    }

    const now = new Date();
    await cashTransactions.updateOne(
      { _id: txnId },
      {
        $set: {
          status: "voided",
          voidedAt: now,
          updatedAt: now,
        },
      },
    );

    const updated = await cashTransactions.findOne({ _id: txnId });
    if (!updated) return jsonError("Update failed", 500);
    return jsonOk({ transaction: serializeCashTransaction(updated) });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
