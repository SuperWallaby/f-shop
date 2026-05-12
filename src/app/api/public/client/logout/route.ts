import { clearClientSessionCookie } from "@/lib/clientSession";
import { jsonOk } from "@/app/api/_utils/http";

export async function POST() {
  return clearClientSessionCookie(jsonOk({ loggedOut: true }));
}
