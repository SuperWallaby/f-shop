import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { getCreditBalance, publicClient } from "@/lib/credits";
import { requireAdmin } from "../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../_utils/http";

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const { clients, creditLedger, orders, bookings, items } = await getCollections();
    const filter = q
      ? {
          $or: [
            { name: new RegExp(escapeRegex(q), "i") },
            { email: new RegExp(escapeRegex(q), "i") },
            { whatsapp: new RegExp(escapeRegex(q), "i") },
          ],
        }
      : {};

    const docs = await clients.find(filter).sort({ updatedAt: -1 }).limit(100).toArray();
    const rows = await Promise.all(
      docs.map(async (client) => {
        const [balance, orderDocs, bookingDocs] = await Promise.all([
          getCreditBalance({ creditLedger, clientId: client._id! }),
          orders
            .find({ clientId: client._id! })
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray(),
          bookings
            .find({ clientId: client._id! })
            .sort({ dateKey: -1, startMin: -1 })
            .limit(50)
            .toArray(),
        ]);

        const itemIds = [...new Set(bookingDocs.map((b) => b.itemId.toString()))];
        const itemDocs =
          itemIds.length === 0
            ? []
            : await items
                .find({ _id: { $in: itemIds.map((id) => new ObjectId(id)) } })
                .project({ name: 1 })
                .toArray();
        const itemNameById = new Map(itemDocs.map((it) => [it._id!.toString(), it.name]));

        return {
          client: publicClient(client),
          balance,
          ordersHistory: orderDocs.map((order) => ({
            id: order._id!.toHexString(),
            orderRef: order.orderRef,
            planTitle: order.planTitle,
            status: order.status,
            classCount: order.classCount,
            amountRm: order.amountRm,
            createdAt: order.createdAt.toISOString(),
            paidAt: order.paidAt?.toISOString() ?? null,
          })),
          bookingHistory: bookingDocs.map((booking) => ({
            id: booking._id!.toHexString(),
            code: booking.code ?? "",
            dateKey: booking.dateKey,
            status: booking.status,
            startMin: booking.startMin,
            endMin: booking.endMin,
            itemName: itemNameById.get(booking.itemId.toString()) ?? "Class",
          })),
        };
      }),
    );

    return jsonOk({ clients: rows });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
