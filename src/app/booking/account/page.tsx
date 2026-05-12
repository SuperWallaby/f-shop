"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DateTime } from "luxon";
import SiteHeader from "@/components/SiteHeader";
import { PlanPurchaseSection, PlanPurchaseWhatsAppLead } from "@/components/PlanPurchaseSection";
import { usePlanPurchase } from "@/hooks/usePlanPurchase";
import ArrowLeftIcon from "@heroicons/react/24/outline/ArrowLeftIcon";
import MagnifyingGlassIcon from "@heroicons/react/24/outline/MagnifyingGlassIcon";

type ClientMe = {
  authed: boolean;
  client?: {
    id: string;
    name: string;
    email: string;
    whatsapp: string;
    studentStatus: "none" | "pending" | "verified" | "rejected";
  };
  balance?: {
    balance: number;
    expiringCredits: Array<{ amount: number; expiresAt: string | Date; source: string }>;
  };
};

export default function BookingAccountPage() {
  const [loading, setLoading] = useState(true);
  const [clientMe, setClientMe] = useState<ClientMe>({ authed: false });
  const planPurchase = usePlanPurchase({ enabled: clientMe.authed });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/public/client/me", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && res.ok && json?.ok) {
          setClientMe(json.data as ClientMe);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const profileWhatsapp = (clientMe.client?.whatsapp ?? "").trim();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F6] text-[#444444] px-6 py-24">
        <SiteHeader />
        <main className="max-w-3xl mx-auto mt-16 text-sm text-[#716D64]">Loading…</main>
      </div>
    );
  }

  if (!clientMe.authed) {
    return (
      <div className="min-h-screen bg-[#FAF8F6] text-[#444444] px-6 py-24">
        <SiteHeader />
        <main className="max-w-md mx-auto mt-16 space-y-4">
          <Link
            href="/booking"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to booking
          </Link>
          <div className="rounded-3xl border border-[#E8DDD4] bg-white/70 p-8 shadow-sm">
            <h1 className="font-serif text-2xl font-bold">My account</h1>
            <p className="mt-2 text-sm text-[#716D64]">Sign in on the booking page to manage plans.</p>
            <Link
              href="/booking"
              className="mt-6 inline-flex rounded-full bg-[#DFD1C9] px-6 py-3 text-sm font-medium text-[#444444] hover:brightness-95"
            >
              Go to booking / sign in
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F6] text-[#444444] px-6 py-24">
      <SiteHeader />
      <main className="max-w-3xl mx-auto mt-16 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/booking"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to booking
          </Link>
          <Link
            href="/booking/check"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
            Booking check
          </Link>
        </div>

        <h1 className="font-serif text-2xl font-bold">My account</h1>

        <div className="bg-white/70 border border-[#E8DDD4] rounded-3xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-serif text-xl font-semibold">Profile & credits</h2>
              <div className="mt-1 text-sm text-[#716D64]">Buy more credits any time via WhatsApp.</div>
            </div>
            <div className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-right">
              <div className="text-xs text-[#716D64]">Balance</div>
              <div className="font-serif text-2xl font-semibold">
                {clientMe.balance?.balance ?? 0} credits
              </div>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-[#E8DDD4] bg-white px-5 py-4">
            <div className="font-medium">{clientMe.client?.name}</div>
            <div className="mt-1 text-xs text-[#716D64]">
              {clientMe.client?.email}
              {profileWhatsapp ? ` · ${profileWhatsapp}` : ""}
            </div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="rounded-full border border-[#E8DDD4] bg-[#FAF8F6] px-3 py-1 text-[11px] text-[#716D64]">
                Student: {clientMe.client?.studentStatus ?? "none"}
              </span>
              {clientMe.balance?.expiringCredits?.[0] ? (
                <span className="rounded-full border border-[#E8DDD4] bg-[#FAF8F6] px-3 py-1 text-[11px] text-[#716D64]">
                  Next expiry:{" "}
                  {DateTime.fromISO(
                    String(clientMe.balance.expiringCredits[0].expiresAt),
                  ).toFormat("LLL d, yyyy")}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <PlanPurchaseSection
          studentStatus={clientMe.client?.studentStatus}
          plans={planPurchase.plans}
          plansLoading={planPurchase.plansLoading}
          planOrderLoading={planPurchase.planOrderLoading}
          planOrderMessage={planPurchase.planOrderMessage}
          orderError={planPurchase.orderError}
          onPay={planPurchase.payForPlan}
          title="Choose a plan"
          description={<PlanPurchaseWhatsAppLead beforeSend="Pick a package and" />}
        />
      </main>
    </div>
  );
}
