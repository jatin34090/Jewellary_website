"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, Notice, SelectInput } from "@/components/ui/form";
import { ApiError } from "@/lib/api/errors";
import { formatDate, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders/labels";
import { formatPrice } from "@/lib/money";
import { authorizedRequest } from "@/lib/session/session";
import type { AdminOrder } from "@/components/admin/types";

const PAGE_SIZE = 20;
const STATUSES: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

interface OrderPage {
  items: AdminOrder[];
  page: number;
  pageSize: number;
  total: number;
}

export default function OrdersPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<OrderPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (status) params.set("status", status);
    setResult(null);
    authorizedRequest<OrderPage>(`/admin/orders?${params.toString()}`)
      .then(setResult)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Could not load orders.");
      });
  }, [status, page]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-gold-deep uppercase">Sales</p>
          <h1 className="mt-2 font-serif text-3xl text-brown">Orders</h1>
        </div>
        <div className="w-56">
          <SelectInput
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {ORDER_STATUS_LABEL[value]}
              </option>
            ))}
          </SelectInput>
        </div>
      </header>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {!result && !error ? <p className="text-sm text-muted">Loading orders…</p> : null}

      {result ? (
        <>
          <div className="overflow-x-auto rounded-md border border-line bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line bg-cream-deep/50 text-xs tracking-wide text-brown-soft uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted">
                      No orders for this filter.
                    </td>
                  </tr>
                ) : (
                  result.items.map((order) => (
                    <tr key={order.orderNumber}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/orders/${order.orderNumber}`}
                          className="font-medium text-brown hover:text-gold-deep"
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-brown-soft">{formatDate(order.createdAt)}</td>
                      <td className="px-4 py-3 text-brown-soft">
                        {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                      </td>
                      <td className="px-4 py-3 text-brown">{formatPrice(order.total)}</td>
                      <td className="px-4 py-3 text-xs text-brown-soft">
                        {ORDER_STATUS_LABEL[order.status]}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
            <p className="text-muted">
              Page {page} of {totalPages} · {result.total} orders
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => {
                  setPage((p) => p - 1);
                }}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => {
                  setPage((p) => p + 1);
                }}
              >
                Next
              </Button>
            </div>
          </nav>
        </>
      ) : null}
    </div>
  );
}
