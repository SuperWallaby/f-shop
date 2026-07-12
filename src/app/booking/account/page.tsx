"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DateTime } from "luxon";
import SiteHeader from "@/components/SiteHeader";
import { PlanPurchaseSection, PlanPurchaseWhatsAppLead } from "@/components/PlanPurchaseSection";
import { CreditExpiryBannerStack } from "@/components/CreditExpiryBannerStack";
import { usePlanPurchase } from "@/hooks/usePlanPurchase";
import { CompleteNameGate } from "../_components/CompleteNameGate";
import { AccountBookingHistory } from "../_components/AccountBookingHistory";
import { clientNeedsName } from "@/lib/clientNeedsName";
import ArrowLeftIcon from "@heroicons/react/24/outline/ArrowLeftIcon";
import MagnifyingGlassIcon from "@heroicons/react/24/outline/MagnifyingGlassIcon";

type ExpiryAlertDto = {
  expiresAt: string;
  windowStart: string;
  windowEnd: string;
  credits: number;
  expiryApproved: boolean;
  showBanner: boolean;
  ledgerIds: string[];
};

type ClientMe = {
  authed: boolean;
  needsName?: boolean;
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
    expiryAlerts?: ExpiryAlertDto[];
  };
};

export default function BookingAccountPage() {
  const [loading, setLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [clientMe, setClientMe] = useState<ClientMe>({ authed: false });
  const planPurchase = usePlanPurchase({
    enabled: clientMe.authed && !clientNeedsName(clientMe),
  });

  const refreshClient = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/public/client/me", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json?.ok) {
        setClientMe(json.data as ClientMe);
      }
    } catch {
      // keep session on network errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshClient();
  }, []);

  const profileWhatsapp = (clientMe.client?.whatsapp ?? "").trim();

  async function signOut() {
    if (
      !window.confirm(
        "Sign out of this device? You can sign in again with the same email anytime.",
      )
    ) {
      return;
    }
    setLogoutLoading(true);
    try {
      await fetch("/api/public/client/logout", { method: "POST" });
      setClientMe({ authed: false });
    } finally {
      setLogoutLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-fasea-canvas text-fasea-tertiary px-6 py-24">
        <SiteHeader />
        <main className="max-w-3xl mx-auto mt-16 text-sm text-fasea-secondary">Loading…</main>
      </div>
    );
  }

  if (!clientMe.authed) {
    return (
      <div className="min-h-screen bg-fasea-canvas text-fasea-tertiary px-6 py-24">
        <SiteHeader />
        <main className="max-w-md mx-auto mt-16 space-y-4">
          <Link
            href="/booking"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-fasea-border bg-white/80 text-sm hover:shadow-sm transition"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to booking
          </Link>
          <div className="rounded-3xl border border-fasea-border bg-white/70 p-8 shadow-sm">
            <h1 className="font-serif text-2xl font-bold">My account</h1>
            <p className="mt-2 text-sm text-fasea-secondary">
              Sign in on the booking page to manage plans.
            </p>
            <Link
              href="/booking"
              className="mt-6 inline-flex rounded-full bg-fasea-tonal px-6 py-3 text-sm font-medium text-fasea-tertiary hover:brightness-95"
            >
              Go to booking
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (clientNeedsName(clientMe)) {
    return (
      <CompleteNameGate
        email={clientMe.client?.email}
        onSaved={refreshClient}
      />
    );
  }

  return (
    <div className="min-h-screen bg-fasea-canvas text-fasea-tertiary px-6 py-24">
      <SiteHeader />
      <main className="max-w-3xl mx-auto mt-16 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/booking"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-fasea-border bg-white/80 text-sm hover:shadow-sm transition"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to booking
          </Link>
          <Link
            href="/booking/check"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-fasea-border bg-white/80 text-sm hover:shadow-sm transition"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
            Booking check
          </Link>
        </div>

        <h1 className="font-serif text-2xl font-bold">My account</h1>

        {clientMe.balance?.expiryAlerts?.length ? (
          <CreditExpiryBannerStack alerts={clientMe.balance.expiryAlerts} />
        ) : null}

        <div className="bg-white/70 border border-fasea-border rounded-3xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-serif text-xl font-semibold">Profile & credits</h2>
              <div className="mt-1 text-sm text-fasea-secondary">Buy more credits any time via WhatsApp.</div>
            </div>
            <div className="rounded-2xl border border-fasea-border bg-white px-4 py-3 text-right">
              <div className="text-xs text-fasea-secondary">Balance</div>
              <div className="font-serif text-2xl font-semibold">
                {clientMe.balance?.balance ?? 0} credits
              </div>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-fasea-border bg-white px-5 py-4">
            <div className="font-medium">{clientMe.client?.name}</div>
            <div className="mt-1 text-xs text-fasea-secondary">
              {clientMe.client?.email}
              {profileWhatsapp ? ` · ${profileWhatsapp}` : ""}
            </div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="rounded-full border border-fasea-border bg-fasea-canvas px-3 py-1 text-[11px] text-fasea-secondary">
                Student: {clientMe.client?.studentStatus ?? "none"}
              </span>
              {clientMe.balance?.expiringCredits?.[0] ? (
                <span className="rounded-full border border-fasea-border bg-fasea-canvas px-3 py-1 text-[11px] text-fasea-secondary">
                  Next expiry:{" "}
                  {DateTime.fromISO(
                    String(clientMe.balance.expiringCredits[0].expiresAt),
                  ).toFormat("LLL d, yyyy")}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <AccountBookingHistory />

        <PlanPurchaseSection
          studentStatus={clientMe.client?.studentStatus}
          plans={planPurchase.plans}
          plansLoading={planPurchase.plansLoading}
          planOrderLoading={planPurchase.planOrderLoading}
          orderError={planPurchase.orderError}
          onPay={planPurchase.payForPlan}
          title="Choose a plan"
          description={<PlanPurchaseWhatsAppLead beforeSend="Pick a package and" />}
        />

        <div className="pt-2">
          <button
            type="button"
            disabled={logoutLoading}
            onClick={() => void signOut()}
            className="text-sm text-fasea-secondary underline disabled:opacity-50"
          >
            {logoutLoading ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </main>
    </div>
  );
}
