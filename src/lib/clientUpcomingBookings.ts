import type { Collection, ObjectId } from "mongodb";
import { DateTime } from "luxon";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import type { BookingDb } from "@/lib/db";

/** Lightweight flag for customer session payloads (Book tab loading UX). */
export async function clientHasUpcomingBookings(args: {
  bookings: Collection<BookingDb>;
  clientId: ObjectId;
  email?: string | null;
}): Promise<boolean> {
  const todayKey = DateTime.now()
    .setZone(BUSINESS_TIME_ZONE)
    .toFormat("yyyy-MM-dd");
  const emailLower = (args.email ?? "").trim().toLowerCase();
  const ownershipFilter = {
    $or: [
      { clientId: args.clientId },
      ...(emailLower
        ? [
            {
              email: new RegExp(
                `^${emailLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
                "i",
              ),
            },
          ]
        : []),
    ],
  };
  const count = await args.bookings.countDocuments({
    ...ownershipFilter,
    status: "confirmed",
    dateKey: { $gte: todayKey },
  });
  return count > 0;
}
