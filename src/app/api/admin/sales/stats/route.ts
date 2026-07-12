import { NextRequest } from "next/server";
import { DateTime } from "luxon";
import { getCollections } from "@/lib/db";
import { adminSalesStatsQuerySchema } from "@/lib/schemas";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { requireAdmin } from "../../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../../_utils/http";

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const parsed = adminSalesStatsQuerySchema.safeParse({
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });
    if (!parsed.success) {
      return jsonError("Invalid query", 400, parsed.error.flatten());
    }

    const from = DateTime.fromISO(parsed.data.from, {
      zone: BUSINESS_TIME_ZONE,
    }).startOf("day");
    const to = DateTime.fromISO(parsed.data.to, {
      zone: BUSINESS_TIME_ZONE,
    }).endOf("day");
    if (!from.isValid || !to.isValid) {
      return jsonError("Invalid date range", 400);
    }

    const { sales } = await getCollections();
    const docs = await sales
      .find({
        soldAt: { $gte: from.toJSDate(), $lte: to.toJSDate() },
      })
      .toArray();

    let paidRevenue = 0;
    let refundTotal = 0;
    let paidCount = 0;
    let refundCount = 0;
    let creditsGranted = 0;
    const dailyMap = new Map<string, { revenue: number; refunds: number; sales: number }>();
    const byPlan = new Map<string, { label: string; revenue: number; count: number }>();
    const byItem = new Map<string, { label: string; revenue: number; count: number }>();
    const byPromo = new Map<string, { label: string; revenue: number; count: number }>();

    for (const s of docs) {
      const dateKey =
        DateTime.fromJSDate(s.soldAt, { zone: BUSINESS_TIME_ZONE }).toISODate() ??
        "";
      const day = dailyMap.get(dateKey) ?? {
        revenue: 0,
        refunds: 0,
        sales: 0,
      };

      if (s.status === "refunded") {
        refundCount += 1;
        const amt = s.refundAmountRm ?? s.amountRm;
        refundTotal += amt;
        day.refunds += amt;
      } else {
        paidCount += 1;
        paidRevenue += s.amountRm;
        day.revenue += s.amountRm;
        day.sales += 1;
        creditsGranted += s.classCount;
        if (s.clientId) {
          // already counted classCount for grants that happened
        }

        const planKey = s.planTitle || "No plan";
        const planRow = byPlan.get(planKey) ?? {
          label: planKey,
          revenue: 0,
          count: 0,
        };
        planRow.revenue += s.amountRm;
        planRow.count += 1;
        byPlan.set(planKey, planRow);

        const itemKey = s.itemName || "No class type";
        const itemRow = byItem.get(itemKey) ?? {
          label: itemKey,
          revenue: 0,
          count: 0,
        };
        itemRow.revenue += s.amountRm;
        itemRow.count += 1;
        byItem.set(itemKey, itemRow);

        if (s.promotionName) {
          const promoRow = byPromo.get(s.promotionName) ?? {
            label: s.promotionName,
            revenue: 0,
            count: 0,
          };
          promoRow.revenue += s.amountRm;
          promoRow.count += 1;
          byPromo.set(s.promotionName, promoRow);
        }
      }
      dailyMap.set(dateKey, day);
    }

    // Fill daily series across range
    const daily: Array<{
      dateKey: string;
      revenue: number;
      refunds: number;
      net: number;
      sales: number;
    }> = [];
    let cur = from.startOf("day");
    const end = to.startOf("day");
    while (cur <= end) {
      const key = cur.toISODate()!;
      const row = dailyMap.get(key) ?? { revenue: 0, refunds: 0, sales: 0 };
      daily.push({
        dateKey: key,
        revenue: row.revenue,
        refunds: row.refunds,
        net: row.revenue - row.refunds,
        sales: row.sales,
      });
      cur = cur.plus({ days: 1 });
    }

    const sortBreakdown = (
      m: Map<string, { label: string; revenue: number; count: number }>,
    ) =>
      [...m.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 12);

    return jsonOk({
      from: parsed.data.from,
      to: parsed.data.to,
      kpis: {
        paidRevenue,
        refundTotal,
        netRevenue: paidRevenue - refundTotal,
        paidCount,
        refundCount,
        creditsGranted,
      },
      daily,
      byPlan: sortBreakdown(byPlan),
      byItem: sortBreakdown(byItem),
      byPromotion: sortBreakdown(byPromo),
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
