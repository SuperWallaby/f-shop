import { NextRequest } from "next/server";
import { MongoServerError, ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import {
  backfillBookingConsumesForClient,
  getCreditBalance,
  makeCustomerKey,
  publicClient,
} from "@/lib/credits";
import {
  dedupeClientsByWhatsapp,
  findClientsByWhatsapp,
} from "@/lib/clientMerge";
import { adminRegisterClientSchema } from "@/lib/schemas";
import { clientWhatsappFields } from "@/lib/whatsapp";
import {
  clientBookingHistoryFilter,
  unlinkedBookingsMatchFilter,
} from "@/lib/resolveBookingClient";
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

    // Heal +60 / 60 / 0… duplicates whenever admin opens Clients & Credits.
    try {
      await dedupeClientsByWhatsapp({
        clients,
        creditLedger,
        orders,
        bookings,
      });
    } catch {
      // best-effort
    }
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
        const clientEmail = (client.email ?? "").trim();
        const clientWa = (client.whatsapp ?? "").trim();
        const unlinkedFilter = unlinkedBookingsMatchFilter({
          email: clientEmail,
          whatsapp: clientWa,
        });
        if (unlinkedFilter) {
          const needsLink = await bookings.findOne(unlinkedFilter);
          if (needsLink) {
            await bookings.updateMany(unlinkedFilter, {
              $set: { clientId: client._id! },
            });
          }
        }
        // Heal missing consumes for linked confirmed/no-show bookings (idempotent).
        await backfillBookingConsumesForClient({
          bookings,
          creditLedger,
          clientId: client._id!,
          note: "Linked past booking",
        });

        const bookingFilter = clientBookingHistoryFilter({
          clientId: client._id!,
          email: clientEmail,
          whatsapp: clientWa,
        });

        const [balance, orderDocs, bookingDocs] = await Promise.all([
          getCreditBalance({ creditLedger, clientId: client._id! }),
          orders
            .find({ clientId: client._id! })
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray(),
          bookings
            .find(bookingFilter)
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
            quantity: order.quantity && order.quantity > 0 ? order.quantity : 1,
            classCount: order.classCount,
            amountRm: order.amountRm,
            createdAt: order.createdAt.toISOString(),
            paidAt: order.paidAt?.toISOString() ?? null,
            saleId: order.saleId?.toHexString() ?? null,
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
    const waFields = whatsappRaw ? clientWhatsappFields(whatsappRaw) : null;
    const whatsapp = waFields?.whatsapp ?? "";
    const linkPast = d.linkPastBookings !== false;
    const now = new Date();

    const { clients, creditLedger, bookings } = await getCollections();

    let client = await clients.findOne({ email });
    let created = false;

    if (whatsapp) {
      const waMatches = await findClientsByWhatsapp(clients, whatsapp);
      const other = waMatches.find(
        (c) => !client?._id || !c._id.equals(client._id!),
      );
      if (other) {
        const otherEmail = (other.email ?? "").trim().toLowerCase();
        if (otherEmail && otherEmail !== email) {
          return jsonError(
            `This WhatsApp is already registered to ${other.name || "a client"} (${other.email}). Open that client instead of creating a new one.`,
            409,
            {
              code: "whatsapp_taken",
              existingClient: {
                id: other._id.toHexString(),
                name: other.name,
                email: other.email,
                whatsapp: other.whatsapp,
              },
            },
          );
        }
        // Same person found by WhatsApp only (email empty / match) — use that row
        if (!client) client = other;
      }
    }

    if (client) {
      await clients.updateOne(
        { _id: client._id },
        {
          $set: {
            name,
            email,
            ...(waFields
              ? {
                  whatsapp: waFields.whatsapp,
                  whatsappDigits: waFields.whatsappDigits,
                }
              : {}),
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
          ...(waFields ? { whatsappDigits: waFields.whatsappDigits } : {}),
          studentStatus: "none",
          createdAt: now,
          updatedAt: now,
        });
        client = await clients.findOne({ _id: ins.insertedId });
        created = true;
      } catch (e) {
        if (e instanceof MongoServerError && e.code === 11000) {
          const msg = String(e.message ?? "");
          if (msg.includes("whatsappDigits")) {
            return jsonError(
              "This WhatsApp number is already registered to another client.",
              409,
              { code: "whatsapp_taken" },
            );
          }
          return jsonError("Client already exists for this contact", 409);
        }
        throw e;
      }
      if (!client) return jsonError("Could not create client", 500);
    }

    const clientId = client._id!;
    let linkedBookings = 0;
    let backfilledConsumes = 0;
    if (linkPast) {
      const linkFilter = unlinkedBookingsMatchFilter({
        email,
        whatsapp,
      });
      if (linkFilter) {
        const linkRes = await bookings.updateMany(linkFilter, {
          $set: { clientId },
        });
        linkedBookings = linkRes.modifiedCount;
      }

      const backfill = await backfillBookingConsumesForClient({
        bookings,
        creditLedger,
        clientId,
        now,
        note: "Linked past booking",
      });
      backfilledConsumes = backfill.inserted;
    }

    const balance = await getCreditBalance({ creditLedger, clientId });
    return jsonOk({
      client: publicClient(client),
      balance,
      created,
      linkedBookings,
      backfilledConsumes,
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
