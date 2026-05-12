import { NextRequest } from "next/server";
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
    const { clients, creditLedger, orders, bookings } = await getCollections();
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
        const [balance, pendingOrders, recentBookings] = await Promise.all([
          getCreditBalance({ creditLedger, clientId: client._id! }),
          orders
            .find({ clientId: client._id!, status: "pending" })
            .sort({ createdAt: -1 })
            .limit(5)
            .toArray(),
          bookings
            .find({ clientId: client._id! })
            .sort({ dateKey: -1, startMin: -1 })
            .limit(5)
            .toArray(),
        ]);

        return {
          client: publicClient(client),
          balance,
          pendingOrders: pendingOrders.map((order) => ({
            id: order._id!.toHexString(),
            orderRef: order.orderRef,
            planTitle: order.planTitle,
            classCount: order.classCount,
            amountRm: order.amountRm,
            createdAt: order.createdAt,
          })),
          recentBookings: recentBookings.map((booking) => ({
            id: booking._id!.toHexString(),
            code: booking.code ?? "",
            dateKey: booking.dateKey,
            status: booking.status,
          })),
        };
      }),
    );

    return jsonOk({ clients: rows });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
