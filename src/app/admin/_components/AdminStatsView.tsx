"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DateTime } from "luxon";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { Skeleton, SkeletonLine } from "./Skeleton";
import { Pill } from "./Pill";
import type { AdminStatsResponse } from "../_lib/stats";

type StatsRange = {
  from: string;
  to: string;
};

function getDefaultRange(): StatsRange {
  const now = DateTime.now().setZone(BUSINESS_TIME_ZONE);
  return {
    from: now.startOf("month").toISODate() ?? "",
    to: now.endOf("month").toISODate() ?? "",
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatShortDate(dateKey: string) {
  const dt = DateTime.fromISO(dateKey, { zone: BUSINESS_TIME_ZONE });
  return dt.isValid ? dt.toFormat("LLL d") : dateKey;
}

function formatLongDate(dateKey: string) {
  const dt = DateTime.fromISO(dateKey, { zone: BUSINESS_TIME_ZONE });
  return dt.isValid ? dt.toFormat("LLL d, yyyy") : dateKey;
}

function cardTone(value: number): "good" | "muted" {
  return value > 0 ? "good" : "muted";
}

function StatCard(props: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "good" | "warn" | "muted";
}) {
  return (
    <div className="rounded-3xl border border-[#E8DDD4] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-[#716D64]">{props.label}</div>
        <Pill label={props.label} tone={props.tone ?? "neutral"} />
      </div>
      <div className="mt-3 font-serif text-3xl font-semibold text-[#444444]">
        {props.value}
      </div>
      <div className="mt-2 text-xs text-[#716D64]">{props.hint}</div>
    </div>
  );
}

function SectionCard(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[#E8DDD4] bg-white/80 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl font-semibold">{props.title}</h2>
          {props.subtitle ? (
            <div className="mt-1 text-xs text-[#716D64]">{props.subtitle}</div>
          ) : null}
        </div>
      </div>
      <div className="mt-6">{props.children}</div>
    </section>
  );
}

export function AdminStatsView() {
  const defaultRange = useMemo(() => getDefaultRange(), []);
  const [range, setRange] = useState<StatsRange>(defaultRange);
  const [draftRange, setDraftRange] = useState<StatsRange>(defaultRange);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          from: range.from,
          to: range.to,
        });
        const res = await fetch(`/api/admin/stats?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error?.message ?? "Failed to load statistics");
        }
        if (!cancelled) {
          setStats(json.data as AdminStatsResponse);
        }
      } catch (e) {
        if (!cancelled) {
          setStats(null);
          setError(e instanceof Error ? e.message : "Failed to load statistics");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const bestWeekday = useMemo(() => {
    if (!stats?.weekdays.length) return null;
    return [...stats.weekdays].sort((a, b) => b.totalBookings - a.totalBookings)[0] ?? null;
  }, [stats]);

  const topItem = useMemo(() => {
    if (!stats?.items.length) return null;
    return [...stats.items].sort((a, b) => b.totalBookings - a.totalBookings)[0] ?? null;
  }, [stats]);

  const hasData = Boolean(stats && stats.kpis.totalBookings > 0);

  function applyRange() {
    if (!draftRange.from || !draftRange.to) {
      setError("Select both a start date and an end date.");
      return;
    }
    if (draftRange.from > draftRange.to) {
      setError("Start date must be before the end date.");
      return;
    }
    setRange(draftRange);
  }

  function resetToMonth() {
    const next = getDefaultRange();
    setDraftRange(next);
    setRange(next);
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Stats"
        subtitle="Bookings analytics for the selected session date range. Estimated revenue uses the current public per-class pack pricing."
      >
        <div className="flex items-end gap-3 flex-wrap">
          <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">From</span>
            <input
              type="date"
              value={draftRange.from}
              onChange={(e) =>
                setDraftRange((prev) => ({ ...prev, from: e.target.value }))
              }
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-[#716D64]">To</span>
            <input
              type="date"
              value={draftRange.to}
              onChange={(e) =>
                setDraftRange((prev) => ({ ...prev, to: e.target.value }))
              }
              className="rounded-2xl border border-[#E8DDD4] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#DFD1C9]"
            />
          </label>
          <button
            type="button"
            onClick={applyRange}
            className="px-6 py-3 rounded-full bg-[#DFD1C9] text-sm font-medium hover:brightness-95 transition cursor-pointer"
          >
            Apply range
          </button>
          <button
            type="button"
            onClick={resetToMonth}
            className="px-4 py-3 rounded-full border border-[#E8DDD4] bg-white/80 text-sm hover:shadow-sm transition cursor-pointer"
          >
            This month
          </button>
          {stats ? (
            <div className="text-xs text-[#716D64]">
              Viewing {formatLongDate(stats.range.from)} to {formatLongDate(stats.range.to)}
            </div>
          ) : null}
        </div>
        {error ? <div className="mt-4 text-sm text-red-700">{error}</div> : null}
      </SectionCard>

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-3xl border border-[#E8DDD4] bg-white p-5 shadow-sm"
              >
                <SkeletonLine className="w-24" />
                <Skeleton className="mt-4 h-10 w-28 rounded-2xl" />
                <SkeletonLine className="mt-4 w-40" />
              </div>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-80 rounded-3xl" />
            <Skeleton className="h-80 rounded-3xl" />
          </div>
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      ) : null}

      {!loading && stats ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Total bookings"
              value={formatNumber(stats.kpis.totalBookings)}
              hint={`${formatNumber(stats.kpis.confirmedBookings)} confirmed in range`}
              tone="neutral"
            />
            <StatCard
              label="Estimated revenue"
              value={formatCurrency(stats.kpis.estimatedRevenue)}
              hint={`Estimated from ${formatNumber(
                stats.kpis.estimatedRevenueMatchedBookings,
              )} matched confirmed bookings`}
              tone={stats.kpis.estimatedRevenue > 0 ? "good" : "muted"}
            />
            <StatCard
              label="Distinct customers"
              value={formatNumber(stats.kpis.distinctCustomers)}
              hint={`${formatPercent(stats.kpis.returningCustomerRate)} returning customers`}
              tone={cardTone(stats.kpis.distinctCustomers)}
            />
            <StatCard
              label="Cancellation rate"
              value={formatPercent(stats.kpis.cancellationRate)}
              hint={`${formatNumber(stats.kpis.cancelledBookings)} cancelled bookings`}
              tone={stats.kpis.cancelledBookings > 0 ? "warn" : "muted"}
            />
            <StatCard
              label="No-show rate"
              value={formatPercent(stats.kpis.noShowRate)}
              hint={`${formatNumber(stats.kpis.noShowBookings)} no-shows`}
              tone={stats.kpis.noShowBookings > 0 ? "warn" : "muted"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-[#E8DDD4] bg-white p-5 shadow-sm">
              <div className="text-sm text-[#716D64]">Best-selling weekday</div>
              <div className="mt-3 font-serif text-2xl font-semibold">
                {bestWeekday?.weekdayLabel ?? "No data"}
              </div>
              <div className="mt-2 text-xs text-[#716D64]">
                {bestWeekday ? `${bestWeekday.totalBookings} bookings` : "No bookings yet"}
              </div>
            </div>
            <div className="rounded-3xl border border-[#E8DDD4] bg-white p-5 shadow-sm">
              <div className="text-sm text-[#716D64]">Top class type</div>
              <div className="mt-3 font-serif text-2xl font-semibold">
                {topItem?.itemName ?? "No data"}
              </div>
              <div className="mt-2 text-xs text-[#716D64]">
                {topItem
                  ? `${topItem.totalBookings} bookings · Estimated ${formatCurrency(
                      topItem.estimatedRevenue,
                    )}`
                  : "No bookings yet"}
              </div>
            </div>
            <div className="rounded-3xl border border-[#E8DDD4] bg-white p-5 shadow-sm">
              <div className="text-sm text-[#716D64]">Customer mix</div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <Pill
                  label={`New ${stats.customerMix.newCustomers}`}
                  tone={stats.customerMix.newCustomers > 0 ? "neutral" : "muted"}
                />
                <Pill
                  label={`Returning ${stats.customerMix.returningCustomers}`}
                  tone={
                    stats.customerMix.returningCustomers > 0 ? "good" : "muted"
                  }
                />
              </div>
              <div className="mt-3 h-2 rounded-full bg-[#F3ECE6] overflow-hidden">
                <div
                  className="h-full bg-[#716D64]"
                  style={{
                    width:
                      stats.kpis.distinctCustomers > 0
                        ? `${(stats.customerMix.returningCustomers / stats.kpis.distinctCustomers) * 100}%`
                        : "0%",
                  }}
                />
              </div>
              <div className="mt-2 text-xs text-[#716D64]">
                Returning share within the selected range.
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
            <SectionCard
              title="Bookings Trend"
              subtitle="Daily booking volume in the selected range."
            >
              {hasData ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.trend}>
                      <CartesianGrid stroke="#E8DDD4" vertical={false} />
                      <XAxis
                        dataKey="dateKey"
                        tickFormatter={formatShortDate}
                        tick={{ fill: "#716D64", fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: "#D1B9B4" }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "#716D64", fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: "#D1B9B4" }}
                      />
                      <Tooltip
                        labelFormatter={(value) => formatLongDate(String(value))}
                        contentStyle={{
                          borderRadius: 16,
                          border: "1px solid #E8DDD4",
                          backgroundColor: "#FFFFFF",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="totalBookings"
                        name="Total"
                        stroke="#716D64"
                        strokeWidth={3}
                        dot={{ r: 2 }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="confirmedBookings"
                        name="Confirmed"
                        stroke="#A66A4A"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-sm text-[#716D64]">
                  No bookings in this date range yet.
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Class Type Mix"
              subtitle="How bookings are distributed across class types."
            >
              {stats.items.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.items.slice(0, 8)}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 24, bottom: 0 }}
                    >
                      <CartesianGrid stroke="#E8DDD4" horizontal={false} />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fill: "#716D64", fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: "#D1B9B4" }}
                      />
                      <YAxis
                        type="category"
                        dataKey="itemName"
                        width={110}
                        tick={{ fill: "#716D64", fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 16,
                          border: "1px solid #E8DDD4",
                          backgroundColor: "#FFFFFF",
                        }}
                      />
                      <Bar dataKey="totalBookings" name="Bookings" radius={[0, 12, 12, 0]}>
                        {stats.items.slice(0, 8).map((item) => (
                          <Cell key={item.itemId || item.itemName} fill={item.itemColor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-sm text-[#716D64]">
                  No class type data is available for this range.
                </div>
              )}
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            <SectionCard
              title="Weekday Performance"
              subtitle="Which days of the week attract the most bookings."
            >
              {hasData ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.weekdays}>
                      <CartesianGrid stroke="#E8DDD4" vertical={false} />
                      <XAxis
                        dataKey="weekdayLabel"
                        tick={{ fill: "#716D64", fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: "#D1B9B4" }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "#716D64", fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: "#D1B9B4" }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 16,
                          border: "1px solid #E8DDD4",
                          backgroundColor: "#FFFFFF",
                        }}
                      />
                      <Bar
                        dataKey="totalBookings"
                        name="Bookings"
                        radius={[12, 12, 0, 0]}
                        fill="#DFD1C9"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-sm text-[#716D64]">
                  No weekday trend is available without bookings.
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Most Loyal Customers"
              subtitle="Ranked by confirmed bookings, then total bookings, within the selected range."
            >
              {stats.topCustomers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-[#716D64] border-b border-[#E8DDD4]">
                        <th className="pb-3 pr-4 font-medium">Customer</th>
                        <th className="pb-3 pr-4 font-medium">Confirmed</th>
                        <th className="pb-3 pr-4 font-medium">Total</th>
                        <th className="pb-3 pr-4 font-medium">Status mix</th>
                        <th className="pb-3 font-medium">Latest booking</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topCustomers.map((customer) => (
                        <tr
                          key={customer.customerKey}
                          className="border-b border-[#F3ECE6] last:border-b-0"
                        >
                          <td className="py-4 pr-4">
                            <div className="font-medium text-[#444444]">
                              {customer.name}
                            </div>
                            <div className="mt-1 text-xs text-[#716D64]">
                              {customer.whatsapp || customer.email || "No contact info"}
                            </div>
                          </td>
                          <td className="py-4 pr-4">{customer.confirmedBookings}</td>
                          <td className="py-4 pr-4">{customer.totalBookings}</td>
                          <td className="py-4 pr-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Pill
                                label={`C ${customer.confirmedBookings}`}
                                tone="good"
                              />
                              <Pill
                                label={`X ${customer.cancelledBookings}`}
                                tone={
                                  customer.cancelledBookings > 0 ? "warn" : "muted"
                                }
                              />
                              <Pill
                                label={`N ${customer.noShowBookings}`}
                                tone={
                                  customer.noShowBookings > 0 ? "warn" : "muted"
                                }
                              />
                            </div>
                          </td>
                          <td className="py-4">{formatLongDate(customer.latestBookingDateKey)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-[#716D64]">
                  No customer ranking is available for this range.
                </div>
              )}
            </SectionCard>
          </div>
        </>
      ) : null}
    </div>
  );
}
