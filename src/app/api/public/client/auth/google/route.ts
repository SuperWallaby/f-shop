import { NextRequest } from "next/server";
import { jsonError } from "@/app/api/_utils/http";

export async function GET(req: NextRequest) {
  void req;
  return jsonError("Google sign-in is no longer available. Use phone and PIN.", 410);
}
