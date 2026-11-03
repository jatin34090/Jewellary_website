"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { Button, Notice } from "@/components/ui/form";
import type { AdminOrder } from "@/components/admin/types";
import { ApiError } from "@/lib/api/errors";
import { formatDate, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders/labels";
import { formatPrice } from "@/lib/money";
import { authorizedRequest } from "@/lib/session/session";

/** The next steps the API allows from each status. Mirrors the server's transition rules. */
const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; label: string }[]>> = {
  PAID: [
    { status: "PROCESSING", label: "Mark as being packed" },
    { status: "SHIPPED", label: "Mark as shipped" },
    { status: "CANCELLED", label: "Cancel order" },
  ],
  PROCESSING: [
    { status: "SHIPPED", label: "Mark as shipped" },
    { status: "CANCELLED", label: "Cancel order" },
  ],
  SHIPPED: [{ status: "DELIVERED", label: "Mark as delivered" }],
};

export default function AdminOrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = use(params);
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authorizedRequest<AdminOrder>(`/admin/orders/${encodeURIComponent(orderNumber)}`)
      .then(setOrder)
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError && err.status === 404
            ? "Order not found."
            : "Could not load this order.",
        );
      });
  }, [orderNumber]);

  const change = async (status: OrderStatus) => {
    if (
      status === "CANCELLED" &&
      !window.confirm(
        "Cancel this order and return its stock? Refunds are handled in the Razorpay dashboard.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setOrder(
        await authorizedRequest<AdminOrder>(`/admin/orders/${orderNumber}/status`, {
          method: "PATCH",
          body: { status },
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The status could not be changed.");
    } finally {
      setBusy(false);
    }
  };

  if (error && !order) return <Notice tone="error">{error}</Notice>;
  if (!order) return <p className="text-sm text-muted">Loading order…</p>;

  const actions = NEXT[order.status] ?? [];

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/orders"
            className="text-xs text-brown-soft underline-offset-4 hover:underline"
          >
            ← Back to orders
          </Link>
          <h1 className="mt-3 font-serif text-3xl text-brown">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-muted">
            Placed {formatDate(order.createdAt)}
            {order.paidAt ? ` · paid ${formatDate(order.paidAt)}` : ""}
          </p>
        </div>
        <p className="rounded bg-brown px-4 py-2 text-sm text-cream">
          {ORDER_STATUS_LABEL[order.status]}
        </p>
      </header>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {actions.length > 0 ? (
        <section className="flex flex-wrap gap-3 rounded-md border border-line bg-white p-5">
          {actions.map((action) => (
            <Button
              key={action.status}
              variant={action.status === "CANCELLED" ? "danger" : "primary"}
              disabled={busy}
              onClick={() => void change(action.status)}
            >
              {action.label}
            </Button>
          ))}
        </section>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-md border border-line bg-white p-6 text-sm">
          <h2 className="font-serif text-xl text-brown">Customer</h2>
          {order.customer ? (
            <p className="mt-3 text-brown-soft">
              {order.customer.firstName}
              <br />
              {order.customer.email}
            </p>
          ) : null}
          <h3 className="mt-5 text-xs tracking-wide text-muted uppercase">Ship to</h3>
          <p className="mt-2 leading-relaxed text-brown-soft">
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

        <section className="rounded-md border border-line bg-white p-6 text-sm">
          <h2 className="font-serif text-xl text-brown">Delivery</h2>
          {order.shipment ? (
            <p className="mt-3 text-brown-soft">
              {order.shipment.courierName ?? "Courier pending"}
              {order.shipment.awbCode ? ` · AWB ${order.shipment.awbCode}` : ""}
              <span className="mt-1 block text-xs text-muted">
                Booking status: {order.shipment.status}
              </span>
            </p>
          ) : (
            <p className="mt-3 text-muted">
              No courier booking yet. Bookings are retried automatically.
            </p>
          )}
        </section>
      </div>

      <section className="rounded-md border border-line bg-white p-6">
        <h2 className="mb-4 font-serif text-xl text-brown">Items</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="pb-2 font-medium">Item</th>
              <th className="pb-2 font-medium">Qty</th>
              <th className="pb-2 font-medium">Price</th>
              <th className="pb-2 text-right font-medium">Line total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {order.items.map((item) => (
              <tr key={item.sku}>
                <td className="py-3 text-brown">
                  {item.name}
                  <span className="block text-xs text-muted">{item.sku}</span>
                </td>
                <td className="py-3 text-brown-soft">{item.quantity}</td>
                <td className="py-3 text-brown-soft">{formatPrice(item.unitPrice)}</td>
                <td className="py-3 text-right text-brown">{formatPrice(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-5 ml-auto grid max-w-xs gap-2 text-sm">
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
          <div className="flex justify-between border-t border-line pt-2 font-medium text-brown">
            <dt>Total</dt>
            <dd>{formatPrice(order.total)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
