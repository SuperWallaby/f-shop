import { randomInt, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { clientAuthFindPasswordSchema } from "@/lib/schemas";
import { findClientsByWhatsapp, pickPrimaryClient } from "@/lib/clientMerge";
import { hashPassword } from "@/lib/password";
import { sendTempPasswordMessage } from "@/lib/twilioWhatsApp";
import {
  clearLoginFailures,
  loginRateLimitKeys,
} from "@/lib/authRateLimit";
import { jsonError, jsonOk } from "@/app/api/_utils/http";

const RESET_COOLDOWN_MS = 60_000;
const GENERIC_RESPONSE = {
  sent: true,
  message:
    "If an account exists for this phone number, a temporary PIN will be sent shortly.",
};

/** Easy-to-type temp PIN (4 digits). */
function generateTempPin(): string {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

/**
 * Find password: phone → SMS/WhatsApp with temporary 4-digit PIN.
 * Does not sign the user in; they must log in then change password.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = clientAuthFindPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const whatsapp = parsed.data.whatsapp;
    const { clients, authRateLimits } = await getCollections();
    const matches = await findClientsByWhatsapp(clients, whatsapp);
    if (!matches.length) {
      return jsonOk(GENERIC_RESPONSE);
    }

    const client = pickPrimaryClient(matches);
    const now = new Date();
    const tempPin = generateTempPin();
    const passwordHash = await hashPassword(tempPin);
    const resetToken = randomUUID();
    const cooldownCutoff = new Date(now.getTime() - RESET_COOLDOWN_MS);
    const reserved = await clients.updateOne(
      {
        _id: client._id,
        $or: [
          { passwordResetSentAt: { $exists: false } },
          { passwordResetSentAt: { $lte: cooldownCutoff } },
        ],
      },
      {
        $set: {
          passwordResetSentAt: now,
          passwordResetToken: resetToken,
          updatedAt: now,
        },
      },
    );
    if (!reserved.modifiedCount) return jsonOk(GENERIC_RESPONSE);

    try {
      await sendTempPasswordMessage({
        to: whatsapp,
        tempPin,
      });
    } catch (e) {
      await clients.updateOne(
        { _id: client._id, passwordResetToken: resetToken },
        {
          $unset: { passwordResetSentAt: "", passwordResetToken: "" },
          $set: { updatedAt: new Date() },
        },
      );
      console.error("[auth] temporary PIN delivery failed", e);
      return jsonOk(GENERIC_RESPONSE);
    }

    const committed = await clients.updateOne(
      { _id: client._id, passwordResetToken: resetToken },
      {
        $set: {
          passwordHash,
          mustChangePassword: true,
          updatedAt: new Date(),
        },
        $unset: { passwordResetToken: "" },
      },
    );
    if (!committed.modifiedCount) {
      console.error("[auth] temporary PIN delivered but reset reservation was lost");
    } else {
      const [phoneRateLimitKey] = loginRateLimitKeys(req, whatsapp);
      if (phoneRateLimitKey) {
        await clearLoginFailures(authRateLimits, [phoneRateLimitKey]);
      }
    }

    return jsonOk(GENERIC_RESPONSE);
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
