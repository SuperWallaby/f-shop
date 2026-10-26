import type { Collection, ObjectId } from "mongodb";
import { DateTime } from "luxon";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import type { BookingDb, ClientDb, PromotionDb } from "@/lib/db";
import { clientBookingHistoryFilter } from "@/lib/resolveBookingClient";
import { findPromotionForPlanId } from "@/lib/sales";

type PromoDoc = PromotionDb & { _id?: ObjectId };

/** Confirmed bookings whose class has already ended. */
export async function countAttendedClasses(args: {
  bookings: Collection<BookingDb>;
  client: ClientDb & { _id?: ObjectId };
}): Promise<number> {
  if (!args.client._id) return 0;
  const now = DateTime.now().setZone(BUSINESS_TIME_ZONE);
  const todayKey = now.toFormat("yyyy-MM-dd");
  const nowMin = now.hour * 60 + now.minute;
  return args.bookings.countDocuments({
    $and: [
      clientBookingHistoryFilter({
        clientId: args.client._id,
        email: args.client.email,
        whatsapp: args.client.whatsapp,
      }),
      { status: "confirmed" },
      {
        $or: [
          { dateKey: { $lt: todayKey } },
          { dateKey: todayKey, endMin: { $lte: nowMin } },
        ],
      },
    ],
  });
}

export function isPromotionUnlocked(promo: PromotionDb, attended: number) {
  return attended >= (promo.minClassesAttended ?? 0);
}

/**
 * The plan's top promotion, or null when the visitor has not unlocked it.
 * Never falls through to a lower-priority promo, so a locked deal shows list price.
 */
export function findEligiblePromotionForPlanId(
  planIdHex: string,
  promos: PromoDoc[],
  attended: number,
): PromoDoc | null {
  const promo = findPromotionForPlanId(planIdHex, promos);
  return promo && isPromotionUnlocked(promo, attended) ? promo : null;
}

/** Active promotions plus the requesting client's attended-class count (anonymous = 0). */
export async function loadPromotionContext(args: {
  promotions: Collection<PromotionDb>;
  bookings: Collection<BookingDb>;
  clients: Collection<ClientDb>;
  clientId: ObjectId | null;
}): Promise<{ promos: PromoDoc[]; attended: number }> {
  const [promos, client] = await Promise.all([
    args.promotions.find({ active: true }).sort({ sortOrder: 1 }).toArray(),
    args.clientId ? args.clients.findOne({ _id: args.clientId }) : null,
  ]);
  const needsCount = promos.some((p) => (p.minClassesAttended ?? 0) > 0);
  const attended =
    needsCount && client
      ? await countAttendedClasses({ bookings: args.bookings, client })
      : 0;
  return { promos, attended };
}
