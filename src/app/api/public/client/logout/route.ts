import { NextRequest } from "next/server";
import { clearClientSessionCookie } from "@/lib/clientSession";
import { jsonOk } from "@/app/api/_utils/http";

export async function POST(req: NextRequest) {
  return clearClientSessionCookie(jsonOk({ loggedOut: true }), req);
}
