"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/errors";
import { formatDate, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders/labels";
import { formatPrice } from "@/lib/money";
import { authorizedRequest } from "@/lib/session/session";
import { Notice } from "@/components/ui/form";

export interface OrderSummary {
  orderNumber: string;
  status: OrderStatus;
  total: string;
  createdAt: string;
  items: { name: string; quantity: number }[];
}

export function OrderList() {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authorizedRequest<OrderSummary[]>("/orders")
      .then(setOrders)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Could not load your orders.");
      });
  }, []);

  return (
    <section
      aria-labelledby="orders-heading"
      className="rounded-md border border-line bg-white p-6"
    >
      <h2 id="orders-heading" className="mb-5 font-serif text-2xl text-brown">
        Your orders
      </h2>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {!error && orders === null ? <p className="text-sm text-muted">Loading orders…</p> : null}
      {orders?.length === 0 ? (
        <p className="text-sm text-muted">
          You have not placed an order yet.{" "}
          <Link href="/shop" className="text-brown underline underline-offset-4">
            Browse the collection
          </Link>
          .
        </p>
      ) : null}

      <ul className="divide-y divide-line">
        {orders?.map((order) => (
          <li
            key={order.orderNumber}
            className="flex flex-wrap items-center justify-between gap-4 py-4"
          >
            <div>
              <Link
                href={`/orders/${order.orderNumber}`}
                className="font-medium text-brown hover:text-gold-deep"
              >
                {order.orderNumber}
              </Link>
              <p className="mt-1 text-xs text-muted">
                {formatDate(order.createdAt)} ·{" "}
                {order.items.reduce((sum, item) => sum + item.quantity, 0)} item(s)
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-brown">{formatPrice(order.total)}</p>
              <p className="mt-1 text-xs text-brown-soft">{ORDER_STATUS_LABEL[order.status]}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
