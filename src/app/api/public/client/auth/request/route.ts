import { NextRequest } from "next/server";
import { MongoServerError } from "mongodb";
import { getCollections } from "@/lib/db";
import { clientAuthEmailSchema } from "@/lib/schemas";
import { getCreditBalance, makeCustomerKey, publicClient } from "@/lib/credits";
import { setClientSessionCookie } from "@/lib/clientSession";
import { jsonError, jsonOk } from "@/app/api/_utils/http";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = clientAuthEmailSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid body", 400, parsed.error.flatten());

    const { clients, creditLedger } = await getCollections();
    const now = new Date();
    const emailLower = parsed.data.email.trim().toLowerCase();
    const nameTrim = (parsed.data.name ?? "").trim();

    let client = await clients.findOne({ email: emailLower });

    if (!client) {
      const customerKey = makeCustomerKey({ email: emailLower });
      try {
        const ins = await clients.insertOne({
          customerKey,
          name: nameTrim,
          email: emailLower,
          whatsapp: "",
          studentStatus: "none" as const,
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now,
        });
        client = await clients.findOne({ _id: ins.insertedId });
      } catch (e) {
        if (e instanceof MongoServerError && e.code === 11000) {
          client = await clients.findOne({ email: emailLower });
        } else {
          throw e;
        }
      }
    }

    if (!client) return jsonError("Could not create account", 500);

    const patch: Record<string, unknown> = {
      lastLoginAt: now,
      updatedAt: now,
    };
    if (nameTrim) patch.name = nameTrim;
    await clients.updateOne({ _id: client._id }, { $set: patch });

    const refreshed = await clients.findOne({ _id: client._id });
    if (!refreshed) return jsonError("Client not found", 404);

    const balance = await getCreditBalance({ creditLedger, clientId: refreshed._id! });
    const res = jsonOk({
      client: publicClient(refreshed),
      balance,
      needsName: !(refreshed.name ?? "").trim(),
    });
    return setClientSessionCookie(res, refreshed._id!);
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
