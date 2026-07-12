import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { dataDeletionRequestSchema } from "@/lib/schemas";
import { sendDataDeletionRequestNotify } from "@/lib/email";
import { jsonError, jsonOk } from "@/app/api/_utils/http";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = dataDeletionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const email = parsed.data.email.trim().toLowerCase();
    const name = parsed.data.name?.trim() || undefined;
    const whatsapp = parsed.data.whatsapp?.trim() || undefined;
    const message = parsed.data.message?.trim() || undefined;
    const now = new Date();

    const { clients, dataDeletionRequests } = await getCollections();
    const client = await clients.findOne({ email });

    const existing = await dataDeletionRequests.findOne({
      email,
      status: "pending",
    });
    if (existing) {
      return jsonOk({
        requestId: existing._id!.toHexString(),
        alreadySubmitted: true,
      });
    }

    const insert = await dataDeletionRequests.insertOne({
      email,
      name,
      whatsapp,
      message,
      status: "pending",
      clientId: client?._id,
      source: "web",
      createdAt: now,
      updatedAt: now,
    });

    try {
      await sendDataDeletionRequestNotify({
        email,
        name,
        whatsapp,
        message,
        matchedClient: Boolean(client),
      });
    } catch {
      // Request is stored even if email notification fails.
    }

    return jsonOk({
      requestId: insert.insertedId.toHexString(),
      alreadySubmitted: false,
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
