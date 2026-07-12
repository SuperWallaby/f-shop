import { NextRequest } from "next/server";
import { googleMobileAuthSchema } from "@/lib/schemas";
import {
  clientAuthPayload,
  upsertClientFromGoogle,
  verifyGoogleIdToken,
} from "@/lib/googleClientAuth";
import { setClientSessionCookie } from "@/lib/clientSession";
import { jsonError, jsonOk } from "@/app/api/_utils/http";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = googleMobileAuthSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const claims = await verifyGoogleIdToken(parsed.data.idToken);
    const clientId = await upsertClientFromGoogle(claims);
    const data = await clientAuthPayload(clientId);
    return setClientSessionCookie(jsonOk(data), clientId, req);
  } catch (e) {
    const message = e instanceof Error ? e.message : "google_token";
    const code =
      message === "google_unconfigured" ||
      message === "google_email" ||
      message === "google_account"
        ? message
        : "google_token";
    return jsonError(
      code === "google_unconfigured"
        ? "Google sign-in is not configured yet."
        : code === "google_email"
          ? "Google did not provide a verified email."
          : code === "google_account"
            ? "Could not create your account."
            : "Google sign-in failed.",
      401,
      code,
    );
  }
}
