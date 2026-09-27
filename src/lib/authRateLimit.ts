import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import type { Collection } from "mongodb";
import type { AuthRateLimitDb } from "@/lib/db";
import { whatsappDigitsCanonical } from "@/lib/whatsapp";

const RETENTION_MS = 24 * 60 * 60 * 1000;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function requestIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip")?.trim() || "unknown";
}

export function loginRateLimitKeys(req: NextRequest, phone: string): string[] {
  const digits = whatsappDigitsCanonical(phone);
  return [
    `login:phone:${digest(digits || phone)}`,
    `login:ip:${digest(requestIp(req))}`,
  ];
}

export async function getLoginRateLimit(
  collection: Collection<AuthRateLimitDb>,
  keys: string[],
  now = new Date(),
): Promise<{ limited: boolean; retryAfterSeconds: number }> {
  const docs = await collection
    .find({ _id: { $in: keys }, nextAllowedAt: { $gt: now } })
    .toArray();
  const retryAfterMs = docs.reduce(
    (max, doc) => Math.max(max, doc.nextAllowedAt.getTime() - now.getTime()),
    0,
  );
  return {
    limited: retryAfterMs > 0,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
  };
}

function delayForFailure(failures: number, isIpKey: boolean): number {
  // IP limits protect against attackers rotating phone numbers, but use a
  // wider threshold so legitimate users on a shared network are not locked
  // after a handful of mistakes.
  if (isIpKey) {
    if (failures <= 10) return 0;
    if (failures <= 12) return 2_000;
    if (failures <= 15) return 15_000;
    return 15 * 60_000;
  }
  if (failures <= 3) return 0;
  if (failures === 4) return 2_000;
  if (failures === 5) return 5_000;
  if (failures === 6) return 15_000;
  if (failures === 7) return 60_000;
  return 15 * 60_000;
}

export async function recordLoginFailure(
  collection: Collection<AuthRateLimitDb>,
  keys: string[],
  now = new Date(),
): Promise<void> {
  await Promise.all(
    keys.map(async (_id) => {
      const result = await collection.findOneAndUpdate(
        { _id },
        {
          $inc: { failures: 1 },
          $set: { updatedAt: now },
          $setOnInsert: {
            nextAllowedAt: now,
            expiresAt: new Date(now.getTime() + RETENTION_MS),
          },
        },
        { upsert: true, returnDocument: "after" },
      );
      if (!result) return;
      const delayMs = delayForFailure(
        result.failures,
        _id.startsWith("login:ip:"),
      );
      await collection.updateOne(
        { _id, failures: result.failures },
        {
          $set: {
            nextAllowedAt: new Date(now.getTime() + delayMs),
            expiresAt: new Date(now.getTime() + RETENTION_MS),
            updatedAt: now,
          },
        },
      );
    }),
  );
}

export async function clearLoginFailures(
  collection: Collection<AuthRateLimitDb>,
  keys: string[],
): Promise<void> {
  await collection.deleteMany({ _id: { $in: keys } });
}
