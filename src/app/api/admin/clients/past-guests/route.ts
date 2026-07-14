import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { requireAdmin } from "../../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../../_utils/http";

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Distinct past booking contacts (by email) for admin client registration.
 */
export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const { bookings, clients } = await getCollections();

    const match: Record<string, unknown> = {
      email: { $type: "string", $ne: "" },
    };
    if (q) {
      const re = new RegExp(escapeRegex(q), "i");
      match.$or = [{ name: re }, { email: re }, { whatsapp: re }];
    }

    const rows = await bookings
      .aggregate<{
        _id: string;
        name: string;
        email: string;
        whatsapp: string;
        bookingCount: number;
        lastBookedAt: Date;
        lastDateKey: string;
      }>([
        { $match: match },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: { $toLower: "$email" },
            name: { $first: "$name" },
            email: { $first: "$email" },
            whatsapp: { $first: "$whatsapp" },
            bookingCount: { $sum: 1 },
            lastBookedAt: { $first: "$createdAt" },
            lastDateKey: { $first: "$dateKey" },
          },
        },
        { $sort: { lastBookedAt: -1 } },
        { $limit: 150 },
      ])
      .toArray();

    const emails = rows.map((r) => r._id).filter(Boolean);
    const existing =
      emails.length === 0
        ? []
        : await clients
            .find({
              $or: emails.map((e) => ({
                email: new RegExp(`^${escapeRegex(e)}$`, "i"),
              })),
            })
            .project({ email: 1 })
            .toArray();
    const existingSet = new Set(
      existing.map((c) => (c.email ?? "").trim().toLowerCase()),
    );

    return jsonOk({
      guests: rows.map((r) => {
        const email = (r.email ?? "").trim().toLowerCase();
        return {
          name: (r.name ?? "").trim(),
          email,
          whatsapp: (r.whatsapp ?? "").trim(),
          bookingCount: r.bookingCount,
          lastDateKey: r.lastDateKey ?? "",
          lastBookedAt: r.lastBookedAt?.toISOString() ?? null,
          alreadyClient: existingSet.has(email),
        };
      }),
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
