import { NextRequest } from "next/server";
import { z } from "zod";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../../_utils/http";

const bodySchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const { bookings } = await getCollections();
    const now = new Date();
    const result = await bookings.updateOne(
      { code: parsed.data.code, status: "pending" },
      { $set: { dmOpenedAt: now } },
    );

    if (!result.matchedCount) {
      const booking = await bookings.findOne(
        { code: parsed.data.code },
        { projection: { status: 1, dmOpenedAt: 1 } },
      );
      if (!booking) return jsonError("Booking not found", 404);
    }

    return jsonOk({ recorded: true, dmOpenedAt: now.toISOString() });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
