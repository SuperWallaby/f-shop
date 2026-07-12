import { NextRequest } from "next/server";
import { MongoServerError } from "mongodb";
import { getCollections } from "@/lib/db";
import { clientAuthEmailSchema } from "@/lib/schemas";
import { getCreditBalance, makeCustomerKey, publicClient } from "@/lib/credits";
import { setClientSessionCookie } from "@/lib/clientSession";
import { hashPassword, verifyPassword } from "@/lib/password";
import { jsonError, jsonOk } from "@/app/api/_utils/http";

/**
 * Email auth:
 * - With password: sign in (existing) or create account (new)
 * - Without password: only for legacy accounts that have no passwordHash yet
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = clientAuthEmailSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid body", 400, parsed.error.flatten());

    const { clients, creditLedger } = await getCollections();
    const now = new Date();
    const emailLower = parsed.data.email.trim().toLowerCase();
    const nameTrim = (parsed.data.name ?? "").trim();
    const password = parsed.data.password;

    let client = await clients.findOne({ email: emailLower });

    if (client?.passwordHash) {
      if (!password) {
        return jsonError("Enter your 4-digit password.", 401);
      }
      const ok = await verifyPassword(password, client.passwordHash);
      if (!ok) return jsonError("Invalid email or password.", 401);
    } else if (!client) {
      if (!password) {
        return jsonError(
          "Enter a 4-digit password to create your account.",
          400,
        );
      }
      const passwordHash = await hashPassword(password);
      const customerKey = makeCustomerKey({ email: emailLower });
      try {
        const ins = await clients.insertOne({
          customerKey,
          name: nameTrim,
          email: emailLower,
          whatsapp: "",
          passwordHash,
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
    } else if (password) {
      // Legacy account without password — set one on first passworded sign-in
      const passwordHash = await hashPassword(password);
      await clients.updateOne(
        { _id: client._id },
        { $set: { passwordHash, updatedAt: now } },
      );
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
    return setClientSessionCookie(res, refreshed._id!, req);
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
