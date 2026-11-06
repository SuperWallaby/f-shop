import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { optionalEnv } from "@/lib/env";
import { requireAdmin } from "./adminAuth";

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function sameSecret(got: string, expectedSha256: Buffer): boolean {
  return timingSafeEqual(sha256(got), expectedSha256);
}

/**
 * Scheduled jobs: admin cookie, or `x-job-secret` matching AUTO_CANCEL_JOB_SECRET
 * or the sha256 stored in settings.jobSecretSha256 (lets the cron secret be
 * rotated without redeploying).
 */
export async function allowJobRequest(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth) return null;

  const got = (req.headers.get("x-job-secret") ?? "").trim();
  if (!got) return auth;

  const envSecret = optionalEnv("AUTO_CANCEL_JOB_SECRET");
  if (envSecret && sameSecret(got, sha256(envSecret))) return null;

  const { settings } = await getCollections();
  const doc = await settings.findOne(
    { _id: "singleton" },
    { projection: { jobSecretSha256: 1 } },
  );
  const stored = (doc?.jobSecretSha256 ?? "").trim();
  if (/^[0-9a-f]{64}$/i.test(stored) && sameSecret(got, Buffer.from(stored, "hex"))) {
    return null;
  }
  return auth;
}
