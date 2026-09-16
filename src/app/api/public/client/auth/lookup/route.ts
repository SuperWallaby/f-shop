import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { findClientsByWhatsapp } from "@/lib/clientMerge";
import { jsonError, jsonOk } from "@/app/api/_utils/http";

/** Tell the mobile phone-first flow whether to enter or create a PIN. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const whatsapp = typeof body?.whatsapp === "string" ? body.whatsapp : "";
    const digits = whatsapp.replace(/[^0-9]/g, "");
    if (digits.length < 8 || digits.length > 15) {
      return jsonError("Invalid body", 400);
    }

    const { clients } = await getCollections();
    const matches = await findClientsByWhatsapp(clients, whatsapp);
    return jsonOk({
      exists: matches.length > 0,
      hasPassword: matches.some((client) => Boolean(client.passwordHash)),
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
