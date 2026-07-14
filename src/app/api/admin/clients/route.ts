import { NextRequest } from "next/server";
import { MongoServerError, ObjectId, type Filter } from "mongodb";
import { getCollections, type BookingDb } from "@/lib/db";
import {
  getCreditBalance,
  makeCustomerKey,
  publicClient,
} from "@/lib/credits";
import { adminRegisterClientSchema } from "@/lib/schemas";
import { normalizeWhatsapp } from "@/lib/whatsapp";
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
    const { clients, creditLedger, orders, bookings, items } =
      await getCollections();
    const filter = q
      ? {
          $or: [
            { name: new RegExp(escapeRegex(q), "i") },
            { email: new RegExp(escapeRegex(q), "i") },
            { whatsapp: new RegExp(escapeRegex(q), "i") },
          ],
        }
      : {};

    const docs = await clients
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();
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

        const itemIds = [
          ...new Set(bookingDocs.map((b) => b.itemId.toString())),
        ];
        const itemDocs =
          itemIds.length === 0
            ? []
            : await items
                .find({ _id: { $in: itemIds.map((id) => new ObjectId(id)) } })
                .project({ name: 1 })
                .toArray();
        const itemNameById = new Map(
          itemDocs.map((it) => [it._id!.toString(), it.name]),
        );

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

/** Register (or update) a client from past booking contact. Credits/purchases added later. */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const body = await req.json().catch(() => null);
    const parsed = adminRegisterClientSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const d = parsed.data;
    const email = d.email.trim().toLowerCase();
    const name = d.name.trim();
    const whatsappRaw = (d.whatsapp ?? "").trim();
    const whatsapp = whatsappRaw ? normalizeWhatsapp(whatsappRaw) : "";
    const linkPast = d.linkPastBookings !== false;
    const now = new Date();

    const { clients, creditLedger, bookings } = await getCollections();
    let client = await clients.findOne({ email });
    let created = false;

    if (client) {
      await clients.updateOne(
        { _id: client._id },
        {
          $set: {
            name,
            ...(whatsapp ? { whatsapp } : {}),
            updatedAt: now,
          },
        },
      );
      client = await clients.findOne({ _id: client._id });
      if (!client) return jsonError("Client not found", 404);
    } else {
      const customerKey = makeCustomerKey({ email, whatsapp });
      if (!customerKey) return jsonError("Email is required", 400);
      try {
        const ins = await clients.insertOne({
          customerKey,
          name,
          email,
          whatsapp,
          studentStatus: "none",
          createdAt: now,
          updatedAt: now,
        });
        client = await clients.findOne({ _id: ins.insertedId });
        created = true;
      } catch (e) {
        if (e instanceof MongoServerError && e.code === 11000) {
          return jsonError("Client already exists for this contact", 409);
        }
        throw e;
      }
      if (!client) return jsonError("Could not create client", 500);
    }

    const clientId = client._id!;
    let linkedBookings = 0;
    if (linkPast) {
      const linkFilter = {
        email: { $regex: `^${escapeRegex(email)}$`, $options: "i" },
        $or: [{ clientId: { $exists: false } }, { clientId: null }],
      } as Filter<BookingDb>;
      const linkRes = await bookings.updateMany(linkFilter, {
        $set: { clientId },
      });
      linkedBookings = linkRes.modifiedCount;
    }

    const balance = await getCreditBalance({ creditLedger, clientId });
    return jsonOk({
      client: publicClient(client),
      balance,
      created,
      linkedBookings,
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
