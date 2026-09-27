import { jsonError } from "@/app/api/_utils/http";

/** Retained as a tombstone so old clients fail closed instead of passwordless login. */
export async function POST() {
  return jsonError(
    "This recovery method is no longer available. Request a temporary PIN instead.",
    410,
  );
}
