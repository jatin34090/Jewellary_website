"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Notice } from "@/components/ui/form";
import { ORDER_STATUS_LABEL, formatDate } from "@/lib/orders/labels";
import { formatPrice } from "@/lib/money";
import { ApiError } from "@/lib/api/errors";
import { authorizedRequest } from "@/lib/session/session";
import type { AdminOrder } from "@/components/admin/types";

interface Dashboard {
  products: Record<string, number>;
  last30Days: { orders: number; revenue: string };
  pendingPayments: number;
  lowStock: { productId: string; name: string; sku: string; sellable: number; threshold: number }[];
  recentOrders: AdminOrder[];
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authorizedRequest<Dashboard>("/admin/dashboard")
      .then(setData)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Could not load the dashboard.");
      });
  }, []);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <p className="text-sm text-muted">Loading dashboard…</p>;

  const active = data.products["ACTIVE"] ?? 0;
  const drafts = data.products["DRAFT"] ?? 0;

  return (
    <div className="grid gap-8">
      <header>
        <p className="text-xs tracking-[0.2em] text-gold-deep uppercase">Overview</p>
        <h1 className="mt-2 font-serif text-3xl text-brown sm:text-4xl">Good to see you</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Live products" value={String(active)} note={`${drafts} in draft`} />
        <Stat
          label="Orders (30 days)"
          value={String(data.last30Days.orders)}
          note="Paid and after"
        />
        <Stat
          label="Revenue (30 days)"
          value={formatPrice(data.last30Days.revenue)}
          note="Total charged"
        />
        <Stat
          label="Awaiting payment"
          value={String(data.pendingPayments)}
          note="Held for a short time"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-md border border-line bg-white p-6">
          <h2 className="font-serif text-xl text-brown">Low stock</h2>
          {data.lowStock.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nothing is running low.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line text-sm">
              {data.lowStock.map((item) => (
                <li key={item.productId} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <Link
                      href={`/admin/products/${item.productId}`}
                      className="text-brown hover:text-gold-deep"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs text-muted">{item.sku}</p>
                  </div>
                  <span className="text-brown-soft">{item.sellable} left</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-md border border-line bg-white p-6">
          <h2 className="font-serif text-xl text-brown">Recent orders</h2>
          {data.recentOrders.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No orders yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line text-sm">
              {data.recentOrders.map((order) => (
                <li
                  key={order.orderNumber}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div>
                    <Link
                      href={`/admin/orders/${order.orderNumber}`}
                      className="text-brown hover:text-gold-deep"
                    >
                      {order.orderNumber}
                    </Link>
                    <p className="text-xs text-muted">
                      {formatDate(order.createdAt)} · {ORDER_STATUS_LABEL[order.status]}
                    </p>
                  </div>
                  <span className="text-brown-soft">{formatPrice(order.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-5">
      <p className="text-xs tracking-[0.15em] text-muted uppercase">{label}</p>
      <p className="mt-3 font-serif text-3xl text-brown">{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}
