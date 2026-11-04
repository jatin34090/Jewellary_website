"use client";

import { useEffect, useMemo, useState } from "react";

import { Button, Notice } from "@/components/ui/form";
import { ApiError } from "@/lib/api/errors";
import { formatDate, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders/labels";
import { formatPrice } from "@/lib/money";
import { authorizedRequest } from "@/lib/session/session";

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

interface Analytics {
  range: { from: string; to: string; days: number };
  totals: { orders: number; revenue: string; averageOrderValue: string; unitsSold: number };
  daily: { date: string; orders: number; revenue: string }[];
  topProducts: {
    productId: string;
    name: string;
    sku: string;
    slug: string;
    unitsSold: number;
    revenue: string;
  }[];
  statusCounts: Partial<Record<OrderStatus, number>>;
}

const STATUS_ORDER: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

/** Sales for the chosen period. Revenue counts paid, processing, shipped and delivered orders. */
export default function AnalyticsPage() {
  const [days, setDays] = useState<Range>(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    authorizedRequest<Analytics>(`/admin/analytics?days=${days}`)
      .then(setData)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Could not load analytics.");
      });
  }, [days]);

  const peak = useMemo(
    () => Math.max(1, ...(data?.daily.map((row) => Number(row.revenue)) ?? [])),
    [data],
  );

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-gold-deep uppercase">Analytics</p>
          <h1 className="mt-2 font-serif text-3xl text-brown">Sales</h1>
          {data ? (
            <p className="mt-2 text-sm text-muted">
              {formatDate(data.range.from)} to {formatDate(data.range.to)} · India time
            </p>
          ) : null}
        </div>
        <div className="flex gap-2" role="group" aria-label="Period">
          {RANGES.map((range) => (
            <Button
              key={range}
              variant={range === days ? "primary" : "secondary"}
              aria-pressed={range === days}
              onClick={() => {
                setDays(range);
              }}
            >
              Last {range} days
            </Button>
          ))}
        </div>
      </header>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {!data && !error ? <p className="text-sm text-muted">Loading sales…</p> : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Revenue" value={formatPrice(data.totals.revenue)} />
            <Kpi label="Orders" value={String(data.totals.orders)} />
            <Kpi label="Average order" value={formatPrice(data.totals.averageOrderValue)} />
            <Kpi label="Units sold" value={String(data.totals.unitsSold)} />
          </div>

          <section className="rounded-md border border-line bg-white p-6">
            <h2 className="font-serif text-xl text-brown">Revenue by day</h2>
            <div
              className="mt-6 flex h-48 items-end gap-1"
              role="img"
              aria-label={`Daily revenue for the last ${data.range.days} days`}
            >
              {data.daily.map((row) => {
                const height = (Number(row.revenue) / peak) * 100;
                return (
                  <div
                    key={row.date}
                    className="flex h-full flex-1 flex-col justify-end"
                    title={`${formatDate(row.date)}: ${formatPrice(row.revenue)} from ${row.orders} ${row.orders === 1 ? "order" : "orders"}`}
                  >
                    <div
                      className={`min-h-px rounded-t ${row.orders > 0 ? "bg-gold" : "bg-line"}`}
                      style={{ height: `${Math.max(height, row.orders > 0 ? 2 : 0.5)}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted">
              <span>{formatDate(data.daily[0]?.date ?? data.range.from)}</span>
              <span>{formatDate(data.daily[data.daily.length - 1]?.date ?? data.range.to)}</span>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <section className="overflow-x-auto rounded-md border border-line bg-white">
              <h2 className="px-6 pt-6 font-serif text-xl text-brown">Top products by revenue</h2>
              <table className="mt-4 w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-line bg-cream-deep/50 text-xs tracking-wide text-brown-soft uppercase">
                  <tr>
                    <th className="px-6 py-3 font-medium">Product</th>
                    <th className="px-6 py-3 font-medium">Units</th>
                    <th className="px-6 py-3 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.topProducts.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-10 text-center text-muted">
                        No sales in this period yet.
                      </td>
                    </tr>
                  ) : (
                    data.topProducts.map((product) => (
                      <tr key={product.productId}>
                        <td className="px-6 py-3">
                          <p className="font-medium text-brown">{product.name}</p>
                          <p className="text-xs text-muted">{product.sku}</p>
                        </td>
                        <td className="px-6 py-3 text-brown">{product.unitsSold}</td>
                        <td className="px-6 py-3 text-brown">{formatPrice(product.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <section className="h-fit rounded-md border border-line bg-white p-6">
              <h2 className="font-serif text-xl text-brown">Orders by status</h2>
              <p className="mt-1 text-xs text-muted">Orders placed in this period.</p>
              <dl className="mt-5 grid gap-3 text-sm">
                {STATUS_ORDER.map((status) => (
                  <div key={status} className="flex justify-between">
                    <dt className="text-muted">{ORDER_STATUS_LABEL[status]}</dt>
                    <dd className="text-brown tabular-nums">{data.statusCounts[status] ?? 0}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-5">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-2 font-serif text-2xl text-brown tabular-nums">{value}</p>
    </div>
  );
}
