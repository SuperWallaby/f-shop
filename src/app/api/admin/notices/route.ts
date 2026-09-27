import { NextRequest } from "next/server";
import { DateTime } from "luxon";
import { getCollections } from "@/lib/db";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { requireAdmin } from "../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../_utils/http";

type NoticeTab = "calendar" | "bookings" | "expiry" | "sales" | "clients";

type AdminNotice = {
  id: string;
  title: string;
  body: string;
  tone: "attention" | "info";
  tab: NoticeTab;
  createdAt: string;
};

type PendingBookingNotice = {
  id: string;
  code: string;
  name: string;
  whatsapp: string;
  className: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  createdAt: string;
  dmOpenedAt: string | null;
};

function formatMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const now = DateTime.now().setZone(BUSINESS_TIME_ZONE);
    const todayKey = now.toISODate()!;
    const nowMin = now.hour * 60 + now.minute;
    const soon = now.plus({ days: 14 }).endOf("day");

    const { timeSlots, bookings, items, creditLedger, clients, orders, dataDeletionRequests } =
      await getCollections();

    const [slotDocs, expiring, pendingOrders, deletionRequests, pendingBookings] =
      await Promise.all([
      timeSlots.find({ dateKey: todayKey, cancelled: { $ne: true } }).sort({ startMin: 1 }).toArray(),
      creditLedger
        .find({
          amount: { $gt: 0 },
          expiresAt: { $gte: now.startOf("day").toJSDate(), $lte: soon.toJSDate() },
          type: { $in: ["purchase_grant", "admin_adjust"] },
          expiryApproved: { $ne: true },
        })
        .sort({ expiresAt: 1 })
        .limit(20)
        .toArray(),
      orders.find({ status: "pending" }).sort({ createdAt: -1 }).limit(8).toArray(),
      dataDeletionRequests.find({ status: "pending" }).sort({ createdAt: -1 }).limit(8).toArray(),
      bookings
        .find({ status: "pending" })
        .sort({ createdAt: 1 })
        .limit(30)
        .toArray(),
      ]);

    const notices: AdminNotice[] = [];

    const slotIds = slotDocs.map((s) => s._id).filter(Boolean);
    const todayBookings = slotIds.length
      ? await bookings
          .find({ slotId: { $in: slotIds }, status: "confirmed" })
          .toArray()
      : [];

    if (slotDocs.length > 0) {
      const upcoming = slotDocs.filter((s) => s.endMin > nowMin);
      const next = upcoming[0] ?? null;
      let nextLabel = "All of today's classes have finished.";
      if (next) {
        const item = next.itemId
          ? await items.findOne({ _id: next.itemId })
          : null;
        const onNext = todayBookings.filter(
          (b) => b.slotId?.toHexString() === next._id.toHexString(),
        ).length;
        nextLabel = `Next: ${item?.name ?? "Class"} at ${formatMin(next.startMin)} · ${onNext} booked.`;
      }
      notices.push({
        id: "today",
        title: `${todayBookings.length} booking${todayBookings.length === 1 ? "" : "s"} today`,
        body: `${slotDocs.length} class${slotDocs.length === 1 ? "" : "es"} on the schedule. ${nextLabel}`,
        tone: todayBookings.length > 0 ? "attention" : "info",
        tab: "calendar",
        createdAt: now.startOf("day").toISO()!,
      });
    }

    if (expiring.length > 0) {
      const clientIds = [...new Set(expiring.map((row) => row.clientId.toHexString()))];
      const clientDocs = await clients
        .find({ _id: { $in: expiring.map((row) => row.clientId) } })
        .toArray();
      const names = clientDocs
        .map((c) => (c.name || c.email || "").trim())
        .filter(Boolean)
        .slice(0, 3);
      const extra = clientIds.length - names.length;
      const who =
        names.length === 0
          ? "Open Expiry to review them."
          : `${names.join(", ")}${extra > 0 ? ` and ${extra} more` : ""}.`;
      notices.push({
        id: "expiry",
        title: `${expiring.length} credit${expiring.length === 1 ? "" : "s"} expire within 14 days`,
        body: who,
        tone: "attention",
        tab: "expiry",
        createdAt:
          expiring[0]?.createdAt?.toISOString() ?? now.startOf("day").toISO()!,
      });
    }

    if (pendingOrders.length > 0) {
      const latest = pendingOrders[0];
      notices.push({
        id: "orders",
        title: `${pendingOrders.length} plan payment${pendingOrders.length === 1 ? "" : "s"} still pending`,
        body: latest
          ? `Latest: ${latest.planTitle} · RM ${latest.amountRm} (${latest.orderRef}).`
          : "Confirm payment in Sales.",
        tone: "attention",
        tab: "sales",
        createdAt: latest?.createdAt?.toISOString() ?? now.toISO()!,
      });
    }

    if (deletionRequests.length > 0) {
      notices.push({
        id: "deletion",
        title: `${deletionRequests.length} data deletion request${deletionRequests.length === 1 ? "" : "s"}`,
        body: "Someone asked to delete their account data. Review it in Clients.",
        tone: "attention",
        tab: "clients",
        createdAt:
          deletionRequests[0]?.createdAt?.toISOString() ?? now.toISO()!,
      });
    }

    const pendingItemIds = [
      ...new Set(pendingBookings.map((b) => b.itemId.toHexString())),
    ];
    const pendingItems = pendingItemIds.length
      ? await items
          .find({
            _id: {
              $in: pendingBookings.map((b) => b.itemId),
            },
          })
          .toArray()
      : [];
    const pendingItemNames = new Map(
      pendingItems.map((item) => [item._id.toHexString(), item.name]),
    );
    const pending: PendingBookingNotice[] = pendingBookings.map((booking) => ({
      id: booking._id!.toHexString(),
      code: booking.code ?? "",
      name: booking.name,
      whatsapp: booking.whatsapp ?? "",
      className:
        pendingItemNames.get(booking.itemId.toHexString()) ?? "Pilates",
      dateKey: booking.dateKey,
      startMin: booking.startMin,
      endMin: booking.endMin,
      createdAt: booking.createdAt.toISOString(),
      dmOpenedAt: booking.dmOpenedAt?.toISOString() ?? null,
    }));

    return jsonOk({ notices, pendingBookings: pending });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
