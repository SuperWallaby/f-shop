import { NextRequest } from "next/server";
import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { requireAdmin } from "../../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../../_utils/http";

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    const now = DateTime.now().setZone(BUSINESS_TIME_ZONE);
    const from = fromRaw
      ? DateTime.fromISO(fromRaw, { zone: BUSINESS_TIME_ZONE }).startOf("day")
      : now.startOf("day");
    const to = toRaw
      ? DateTime.fromISO(toRaw, { zone: BUSINESS_TIME_ZONE }).endOf("day")
      : now.plus({ days: 90 }).endOf("day");
    if (!from.isValid || !to.isValid) {
      return jsonError("Invalid date range", 400);
    }

    const { creditLedger, clients, plans } = await getCollections();
    const grants = await creditLedger
      .find({
        amount: { $gt: 0 },
        expiresAt: { $gte: from.toJSDate(), $lte: to.toJSDate() },
        type: { $in: ["purchase_grant", "admin_adjust"] },
      })
      .sort({ expiresAt: 1 })
      .limit(500)
      .toArray();

    const clientIds = [
      ...new Set(grants.map((g) => g.clientId.toHexString())),
    ].map((id) => new ObjectId(id));
    const planIds = [
      ...new Set(
        grants
          .filter((g) => g.planId)
          .map((g) => g.planId!.toHexString()),
      ),
    ].map((id) => new ObjectId(id));

    const [clientDocs, planDocs] = await Promise.all([
      clientIds.length
        ? clients.find({ _id: { $in: clientIds } }).toArray()
        : Promise.resolve([]),
      planIds.length
        ? plans.find({ _id: { $in: planIds } }).toArray()
        : Promise.resolve([]),
    ]);
    const clientMap = new Map(
      clientDocs.map((c) => [c._id!.toHexString(), c]),
    );
    const planMap = new Map(planDocs.map((p) => [p._id!.toHexString(), p]));

    const rows = grants.map((g) => {
      const client = clientMap.get(g.clientId.toHexString());
      const plan = g.planId
        ? planMap.get(g.planId.toHexString())
        : undefined;
      const expiresAt = g.expiresAt!;
      const expiresDateKey = DateTime.fromJSDate(expiresAt, {
        zone: BUSINESS_TIME_ZONE,
      }).toISODate();
      const daysLeft = Math.ceil(
        DateTime.fromJSDate(expiresAt, { zone: BUSINESS_TIME_ZONE })
          .startOf("day")
          .diff(now.startOf("day"), "days").days,
      );
      return {
        id: g._id!.toHexString(),
        clientId: g.clientId.toHexString(),
        clientName: client?.name || client?.email || "Unknown",
        clientEmail: client?.email || "",
        amount: g.amount,
        type: g.type,
        planTitle: plan?.title || "",
        note: g.note || "",
        expiresAt: expiresAt.toISOString(),
        expiresDateKey,
        daysLeft,
        expiryApproved: g.expiryApproved ?? null,
        saleId: g.saleId?.toHexString() ?? null,
      };
    });

    return jsonOk({
      from: from.toISODate(),
      to: to.toISODate(),
      rows,
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
