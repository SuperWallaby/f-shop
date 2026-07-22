import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { clientAuthRecoverSchema } from "@/lib/schemas";
import { getCreditBalance, publicClient } from "@/lib/credits";
import {
  findClientsByWhatsapp,
  mergeClientInto,
  pickPrimaryClient,
} from "@/lib/clientMerge";
import { normalizeWhatsapp, clientWhatsappFields } from "@/lib/whatsapp";
import { setClientSessionCookie } from "@/lib/clientSession";
import { jsonError, jsonOk } from "@/app/api/_utils/http";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = clientAuthRecoverSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const { clients, creditLedger, orders, bookings } = await getCollections();
    const now = new Date();
    const nameTrim = parsed.data.name.trim();
    const wa = normalizeWhatsapp(parsed.data.whatsapp);
    const waFields = clientWhatsappFields(wa);

    let matches = await findClientsByWhatsapp(clients, wa);
    matches = matches.filter((c) =>
      new RegExp(`^${escapeRegExp(nameTrim)}$`, "i").test(c.name ?? ""),
    );

    if (matches.length === 0) {
      return jsonError("No account matches that name and phone number.", 404);
    }

    let client = matches[0]!;
    if (matches.length > 1) {
      const primary = pickPrimaryClient(matches);
      for (const other of matches) {
        if (other._id.equals(primary._id)) continue;
        await mergeClientInto(
          { clients, creditLedger, orders, bookings },
          primary._id,
          other._id,
          { whatsapp: wa },
        );
      }
      client = (await clients.findOne({ _id: primary._id })) ?? primary;
    }

    await clients.updateOne(
      { _id: client._id },
      {
        $set: {
          lastLoginAt: now,
          updatedAt: now,
          whatsapp: wa,
          ...(waFields ? { whatsappDigits: waFields.whatsappDigits } : {}),
        },
      },
    );
    const fresh = await clients.findOne({ _id: client._id });
    if (!fresh) return jsonError("Client not found", 404);

    const balance = await getCreditBalance({
      creditLedger,
      clientId: fresh._id!,
    });
    const res = jsonOk({
      client: publicClient(fresh),
      balance,
    });
    return setClientSessionCookie(res, fresh._id!, req);
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
