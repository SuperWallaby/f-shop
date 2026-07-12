import { NextRequest } from "next/server";
import { pushTokenRegisterSchema } from "@/lib/schemas";
import { getClientIdFromRequest } from "@/app/api/_utils/clientAuth";
import { jsonError, jsonOk } from "@/app/api/_utils/http";
import { deletePushToken, upsertPushToken } from "@/lib/pushTokens";

export async function POST(req: NextRequest) {
  const clientId = getClientIdFromRequest(req);
  if (!clientId) return jsonError("Client login required", 401);

  try {
    const body = await req.json().catch(() => null);
    const parsed = pushTokenRegisterSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    await upsertPushToken({
      clientId,
      token: parsed.data.token,
      platform: parsed.data.platform,
    });
    return jsonOk({ registered: true });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

export async function DELETE(req: NextRequest) {
  const clientId = getClientIdFromRequest(req);
  if (!clientId) return jsonError("Client login required", 401);

  try {
    const body = await req.json().catch(() => ({}));
    const token =
      typeof body?.token === "string" ? body.token : undefined;
    await deletePushToken({ clientId, token });
    return jsonOk({ deleted: true });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
