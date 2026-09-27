import { jsonError } from "@/app/api/_utils/http";

/** Retained as a tombstone for clients that still call legacy email auth. */
export async function POST() {
  return jsonError("Phone and 4-digit PIN authentication is required.", 410);
}
