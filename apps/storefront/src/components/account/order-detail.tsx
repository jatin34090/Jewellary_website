"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/errors";
import { formatDate, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders/labels";
import { formatPrice } from "@/lib/money";
import { authorizedRequest } from "@/lib/session/session";
import { Notice } from "@/components/ui/form";

interface OrderDetailData {
  orderNumber: string;
  status: OrderStatus;
  subtotal: string;
  discount: string;
  shipping: string;
  tax: string;
  total: string;
  couponCode: string | null;
  items: { name: string; sku: string; unitPrice: string; quantity: number; lineTotal: string }[];
  shippingAddress: {
    fullName: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    phone: string;
  };
  paidAt: string | null;
  createdAt: string;
  shipment: {
    status: string;
    awbCode: string | null;
    courierName: string | null;
    trackingUrl: string | null;
  } | null;
}

export function OrderDetail({
  orderNumber,
  justPlaced,
}: {
  orderNumber: string;
  justPlaced: boolean;
}) {
  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authorizedRequest<OrderDetailData>(`/orders/${encodeURIComponent(orderNumber)}`)
      .then(setOrder)
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError && err.status === 404
            ? "We could not find that order."
            : "We could not load this order.",
        );
      });
  }, [orderNumber]);

  if (error) {
    return (
      <div className="grid gap-4">
        <Notice tone="error">{error}</Notice>
        <Link href="/account" className="text-sm text-brown underline underline-offset-4">
          Back to my account
        </Link>
      </div>
    );
  }
  if (!order) return <p className="py-20 text-center text-sm text-muted">Loading your order…</p>;

  return (
    <div className="grid gap-8">
      {justPlaced ? (
        <Notice tone="success">
          Thank you. Your payment was received and your order is confirmed.
        </Notice>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-gold-deep uppercase">Order</p>
          <h1 className="mt-2 font-serif text-3xl text-brown">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-muted">Placed {formatDate(order.createdAt)}</p>
        </div>
        <p className="rounded bg-brown px-4 py-2 text-sm tracking-wide text-cream">
          {ORDER_STATUS_LABEL[order.status]}
        </p>
      </header>

      {order.shipment ? (
        <section className="rounded-md border border-line bg-white p-6 text-sm">
          <h2 className="font-serif text-xl text-brown">Delivery</h2>
          {order.shipment.awbCode ? (
            <p className="mt-3 text-brown-soft">
              {order.shipment.courierName ? `${order.shipment.courierName} · ` : ""}Tracking number{" "}
              {order.shipment.awbCode}
            </p>
          ) : (
            <p className="mt-3 text-muted">
              Your courier details will appear here once the parcel is booked.
            </p>
          )}
          {order.shipment.trackingUrl ? (
            <a
              href={order.shipment.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-brown underline underline-offset-4"
            >
              Track your parcel
            </a>
          ) : null}
        </section>
      ) : null}

      <section
        aria-labelledby="items-heading"
        className="rounded-md border border-line bg-white p-6"
      >
        <h2 id="items-heading" className="mb-4 font-serif text-xl text-brown">
          Items
        </h2>
        <ul className="divide-y divide-line text-sm">
          {order.items.map((item) => (
            <li key={item.sku} className="flex justify-between gap-4 py-3">
              <span className="text-brown">
                {item.name} <span className="text-muted">× {item.quantity}</span>
              </span>
              <span className="text-brown">{formatPrice(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd>{formatPrice(order.subtotal)}</dd>
          </div>
          {Number(order.discount) > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted">
                Discount{order.couponCode ? ` (${order.couponCode})` : ""}
              </dt>
              <dd>− {formatPrice(order.discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted">Delivery</dt>
            <dd>{Number(order.shipping) === 0 ? "Free" : formatPrice(order.shipping)}</dd>
          </div>
          {Number(order.tax) > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted">Tax</dt>
              <dd>{formatPrice(order.tax)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between pt-2 text-base font-medium text-brown">
            <dt>Total</dt>
            <dd>{formatPrice(order.total)}</dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="ship-heading"
        className="rounded-md border border-line bg-white p-6 text-sm"
      >
        <h2 id="ship-heading" className="font-serif text-xl text-brown">
          Shipping to
        </h2>
        <p className="mt-3 leading-relaxed text-brown-soft">
          {order.shippingAddress.fullName}
          <br />
          {order.shippingAddress.line1}
          {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}
          <br />
          {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
          {order.shippingAddress.postalCode}
          <br />
          {order.shippingAddress.phone}
        </p>
      </section>

      <Link href="/account" className="text-sm text-brown underline underline-offset-4">
        Back to my account
      </Link>
    </div>
  );
}
