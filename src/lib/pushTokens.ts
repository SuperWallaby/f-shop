import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import type { PushTokenDb } from "@/lib/db";

export async function upsertPushToken(args: {
  clientId: ObjectId;
  token: string;
  platform: PushTokenDb["platform"];
}) {
  const { pushTokens } = await getCollections();
  const now = new Date();
  const token = args.token.trim();
  if (!token) return;

  await pushTokens.updateOne(
    { token },
    {
      $set: {
        clientId: args.clientId,
        token,
        platform: args.platform,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export async function deletePushToken(args: {
  clientId: ObjectId;
  token?: string;
}) {
  const { pushTokens } = await getCollections();
  const filter: { clientId: ObjectId; token?: string } = {
    clientId: args.clientId,
  };
  if (args.token?.trim()) filter.token = args.token.trim();
  await pushTokens.deleteMany(filter);
}

export async function listPushTokensForClient(clientId: ObjectId) {
  const { pushTokens } = await getCollections();
  const rows = await pushTokens.find({ clientId }).toArray();
  return rows.map((r) => r.token).filter(Boolean);
}
