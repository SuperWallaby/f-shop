import { NextRequest } from "next/server";
import { DateTime } from "luxon";
import type { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { requireAdmin } from "../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../_utils/http";
import type { AdminStatsResponse } from "@/app/admin/_lib/stats";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const ESTIMATED_REVENUE_PER_BOOKING = {
  groupMat: 35,
  reformerPrivate: 150,
  duet: 110,
  reformerGroup: 83,
} as const;

function getDefaultRange() {
  const now = DateTime.now().setZone(BUSINESS_TIME_ZONE);
  return {
    from: now.startOf("month").toISODate() ?? "",
    to: now.endOf("month").toISODate() ?? "",
  };
}

function parseDateKeyOrDefault(value: string | null, fallback: string) {
  const next = (value ?? "").trim() || fallback;
  if (!DATE_KEY_RE.test(next)) return null;
  return next;
}

function roundRate(value: number) {
  return Math.round(value * 10) / 10;
}

function getEstimatedRevenuePerBooking(itemName: string) {
  const normalized = itemName.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("duet")) return ESTIMATED_REVENUE_PER_BOOKING.duet;
  if (normalized.includes("private")) {
    return ESTIMATED_REVENUE_PER_BOOKING.reformerPrivate;
  }
  if (normalized.includes("reformer") && normalized.includes("group")) {
    return ESTIMATED_REVENUE_PER_BOOKING.reformerGroup;
  }
  if (normalized.includes("mat")) return ESTIMATED_REVENUE_PER_BOOKING.groupMat;
  return null;
}

const normalizedWhatsappExpr = {
  $trim: { input: { $ifNull: ["$whatsapp", ""] } },
};

const normalizedEmailExpr = {
  $toLower: {
    $trim: { input: { $ifNull: ["$email", ""] } },
  },
};

const customerKeyExpr = {
  $let: {
    vars: {
      normalizedWhatsapp: normalizedWhatsappExpr,
      normalizedEmail: normalizedEmailExpr,
    },
    in: {
      $cond: [
        { $gt: [{ $strLenCP: "$$normalizedWhatsapp" }, 0] },
        { $concat: ["wa:", "$$normalizedWhatsapp"] },
        {
          $cond: [
            { $gt: [{ $strLenCP: "$$normalizedEmail" }, 0] },
            { $concat: ["em:", "$$normalizedEmail"] },
            { $concat: ["guest:", { $toString: "$_id" }] },
          ],
        },
      ],
    },
  },
};

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const defaults = getDefaultRange();
    const from = parseDateKeyOrDefault(req.nextUrl.searchParams.get("from"), defaults.from);
    const to = parseDateKeyOrDefault(req.nextUrl.searchParams.get("to"), defaults.to);

    if (!from || !to) {
      return jsonError("Invalid date range", 400);
    }
    if (from > to) {
      return jsonError("`from` must be before or equal to `to`", 400);
    }

    const fromDt = DateTime.fromISO(from, { zone: BUSINESS_TIME_ZONE });
    const toDt = DateTime.fromISO(to, { zone: BUSINESS_TIME_ZONE });
    if (!fromDt.isValid || !toDt.isValid) {
      return jsonError("Invalid date range", 400);
    }

    const { bookings, items } = await getCollections();
    const match = { dateKey: { $gte: from, $lte: to } };

    const [kpiRows, trendRows, itemRows, weekdayRows, selectedCustomerRows] =
      await Promise.all([
        bookings
          .aggregate<{
            _id: null;
            totalBookings: number;
            confirmedBookings: number;
            cancelledBookings: number;
            noShowBookings: number;
          }>([
            { $match: match },
            {
              $group: {
                _id: null,
                totalBookings: { $sum: 1 },
                confirmedBookings: {
                  $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
                },
                cancelledBookings: {
                  $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
                },
                noShowBookings: {
                  $sum: { $cond: [{ $eq: ["$status", "no_show"] }, 1, 0] },
                },
              },
            },
          ])
          .toArray(),
        bookings
          .aggregate<{
            _id: string;
            totalBookings: number;
            confirmedBookings: number;
            cancelledBookings: number;
            noShowBookings: number;
          }>([
            { $match: match },
            {
              $group: {
                _id: "$dateKey",
                totalBookings: { $sum: 1 },
                confirmedBookings: {
                  $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
                },
                cancelledBookings: {
                  $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
                },
                noShowBookings: {
                  $sum: { $cond: [{ $eq: ["$status", "no_show"] }, 1, 0] },
                },
              },
            },
            { $sort: { _id: 1 } },
          ])
          .toArray(),
        bookings
          .aggregate<{
            _id: ObjectId | null;
            totalBookings: number;
            confirmedBookings: number;
            cancelledBookings: number;
            noShowBookings: number;
          }>([
            { $match: match },
            {
              $group: {
                _id: "$itemId",
                totalBookings: { $sum: 1 },
                confirmedBookings: {
                  $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
                },
                cancelledBookings: {
                  $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
                },
                noShowBookings: {
                  $sum: { $cond: [{ $eq: ["$status", "no_show"] }, 1, 0] },
                },
              },
            },
            { $sort: { totalBookings: -1 } },
          ])
          .toArray(),
        bookings
          .aggregate<{
            _id: number;
            totalBookings: number;
            confirmedBookings: number;
            cancelledBookings: number;
            noShowBookings: number;
          }>([
            { $match: match },
            {
              $addFields: {
                dateObj: {
                  $dateFromString: {
                    dateString: "$dateKey",
                    format: "%Y-%m-%d",
                    timezone: BUSINESS_TIME_ZONE,
                  },
                },
              },
            },
            {
              $group: {
                _id: { $dayOfWeek: "$dateObj" },
                totalBookings: { $sum: 1 },
                confirmedBookings: {
                  $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
                },
                cancelledBookings: {
                  $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
                },
                noShowBookings: {
                  $sum: { $cond: [{ $eq: ["$status", "no_show"] }, 1, 0] },
                },
              },
            },
          ])
          .toArray(),
        bookings
          .aggregate<{
            _id: string;
            name: string;
            email: string;
            whatsapp: string;
            totalBookings: number;
            confirmedBookings: number;
            cancelledBookings: number;
            noShowBookings: number;
            latestBookingDateKey: string;
            latestCreatedAt: Date;
          }>([
            { $match: match },
            {
              $addFields: {
                normalizedWhatsapp: normalizedWhatsappExpr,
                normalizedEmail: normalizedEmailExpr,
                customerKey: customerKeyExpr,
              },
            },
            { $sort: { createdAt: -1 } },
            {
              $group: {
                _id: "$customerKey",
                name: { $first: "$name" },
                email: { $first: "$normalizedEmail" },
                whatsapp: { $first: "$normalizedWhatsapp" },
                totalBookings: { $sum: 1 },
                confirmedBookings: {
                  $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
                },
                cancelledBookings: {
                  $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
                },
                noShowBookings: {
                  $sum: { $cond: [{ $eq: ["$status", "no_show"] }, 1, 0] },
                },
                latestBookingDateKey: { $max: "$dateKey" },
                latestCreatedAt: { $max: "$createdAt" },
              },
            },
          ])
          .toArray(),
      ]);

    const customerFirstSeenRows = selectedCustomerRows.length
      ? await bookings
          .aggregate<{
            _id: string;
            firstBookingDateKey: string;
          }>([
            {
              $addFields: {
                customerKey: customerKeyExpr,
              },
            },
            {
              $match: {
                customerKey: {
                  $in: selectedCustomerRows.map((row) => row._id),
                },
              },
            },
            {
              $group: {
                _id: "$customerKey",
                firstBookingDateKey: { $min: "$dateKey" },
              },
            },
          ])
          .toArray()
      : [];

    const itemDocs = await items
      .find(
        {
          _id: {
            $in: itemRows
              .map((row) => row._id)
              .filter((value): value is ObjectId => value != null),
          },
        },
        { projection: { name: 1, color: 1 } },
      )
      .toArray();

    const itemMetaById = new Map(
      itemDocs.map((item) => [
        item._id!.toHexString(),
        { name: item.name, color: item.color ?? "#DFD1C9" },
      ]),
    );

    const kpisBase = kpiRows[0] ?? {
      totalBookings: 0,
      confirmedBookings: 0,
      cancelledBookings: 0,
      noShowBookings: 0,
    };

    const trendMap = new Map(trendRows.map((row) => [row._id, row]));
    const trend: AdminStatsResponse["trend"] = [];
    for (
      let cursor = fromDt.startOf("day");
      cursor <= toDt.startOf("day");
      cursor = cursor.plus({ days: 1 })
    ) {
      const dateKey = cursor.toISODate() ?? "";
      const row = trendMap.get(dateKey);
      trend.push({
        dateKey,
        totalBookings: row?.totalBookings ?? 0,
        confirmedBookings: row?.confirmedBookings ?? 0,
        cancelledBookings: row?.cancelledBookings ?? 0,
        noShowBookings: row?.noShowBookings ?? 0,
      });
    }

    const itemsBreakdown: AdminStatsResponse["items"] = itemRows.map((row) => {
      const itemId = row._id?.toHexString() ?? "";
      const meta = itemMetaById.get(itemId);
      const itemName = meta?.name ?? "Unknown class";
      const estimatedRevenuePerBooking = getEstimatedRevenuePerBooking(itemName);
      return {
        itemId,
        itemName,
        itemColor: meta?.color ?? "#DFD1C9",
        totalBookings: row.totalBookings,
        confirmedBookings: row.confirmedBookings,
        cancelledBookings: row.cancelledBookings,
        noShowBookings: row.noShowBookings,
        estimatedRevenue:
          estimatedRevenuePerBooking !== null
            ? row.confirmedBookings * estimatedRevenuePerBooking
            : 0,
      };
    });

    const weekdayMap = new Map(weekdayRows.map((row) => [row._id, row]));
    const weekdays: AdminStatsResponse["weekdays"] = WEEKDAY_LABELS.map(
      (weekdayLabel, index) => {
        const mongoIndex = index + 1;
        const row = weekdayMap.get(mongoIndex);
        return {
          weekdayIndex: index,
          weekdayLabel,
          totalBookings: row?.totalBookings ?? 0,
          confirmedBookings: row?.confirmedBookings ?? 0,
          cancelledBookings: row?.cancelledBookings ?? 0,
          noShowBookings: row?.noShowBookings ?? 0,
        };
      },
    );

    const firstSeenByCustomerKey = new Map(
      customerFirstSeenRows.map((row) => [row._id, row.firstBookingDateKey]),
    );

    let newCustomers = 0;
    let returningCustomers = 0;
    const topCustomers = selectedCustomerRows
      .map((row) => {
        const firstBookingDateKey = firstSeenByCustomerKey.get(row._id) ?? row.latestBookingDateKey;
        const isNewCustomer = firstBookingDateKey >= from && firstBookingDateKey <= to;
        if (isNewCustomer) newCustomers += 1;
        else returningCustomers += 1;
        return {
          customerKey: row._id,
          name: row.name || "Unknown customer",
          email: row.email,
          whatsapp: row.whatsapp,
          totalBookings: row.totalBookings,
          confirmedBookings: row.confirmedBookings,
          cancelledBookings: row.cancelledBookings,
          noShowBookings: row.noShowBookings,
          latestBookingDateKey: row.latestBookingDateKey,
          latestCreatedAt: row.latestCreatedAt,
        };
      })
      .sort((a, b) => {
        if (b.confirmedBookings !== a.confirmedBookings) {
          return b.confirmedBookings - a.confirmedBookings;
        }
        if (b.totalBookings !== a.totalBookings) {
          return b.totalBookings - a.totalBookings;
        }
        return b.latestCreatedAt.getTime() - a.latestCreatedAt.getTime();
      })
      .slice(0, 10)
      .map((row) => ({
        customerKey: row.customerKey,
        name: row.name,
        email: row.email,
        whatsapp: row.whatsapp,
        totalBookings: row.totalBookings,
        confirmedBookings: row.confirmedBookings,
        cancelledBookings: row.cancelledBookings,
        noShowBookings: row.noShowBookings,
        latestBookingDateKey: row.latestBookingDateKey,
      }));

    const distinctCustomers = selectedCustomerRows.length;
    const estimatedRevenue = itemsBreakdown.reduce(
      (sum, item) => sum + item.estimatedRevenue,
      0,
    );
    const estimatedRevenueMatchedBookings = itemsBreakdown.reduce((sum, item) => {
      const estimatedRevenuePerBooking = getEstimatedRevenuePerBooking(item.itemName);
      return sum + (estimatedRevenuePerBooking !== null ? item.confirmedBookings : 0);
    }, 0);
    const cancellationRate =
      kpisBase.totalBookings > 0
        ? roundRate((kpisBase.cancelledBookings / kpisBase.totalBookings) * 100)
        : 0;
    const noShowRate =
      kpisBase.totalBookings > 0
        ? roundRate((kpisBase.noShowBookings / kpisBase.totalBookings) * 100)
        : 0;
    const returningCustomerRate =
      distinctCustomers > 0 ? roundRate((returningCustomers / distinctCustomers) * 100) : 0;

    const data: AdminStatsResponse = {
      range: { from, to },
      kpis: {
        totalBookings: kpisBase.totalBookings,
        confirmedBookings: kpisBase.confirmedBookings,
        cancelledBookings: kpisBase.cancelledBookings,
        noShowBookings: kpisBase.noShowBookings,
        distinctCustomers,
        cancellationRate,
        noShowRate,
        returningCustomerRate,
        estimatedRevenue,
        estimatedRevenueMatchedBookings,
      },
      trend,
      items: itemsBreakdown,
      weekdays,
      customerMix: {
        newCustomers,
        returningCustomers,
      },
      topCustomers,
    };

    return jsonOk(data);
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
