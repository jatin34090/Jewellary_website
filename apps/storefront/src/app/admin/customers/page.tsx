"use client";

import { useEffect, useState, type SyntheticEvent } from "react";

import { Button, Notice, TextInput } from "@/components/ui/form";
import { ApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/orders/labels";
import { formatPrice } from "@/lib/money";
import { authorizedRequest } from "@/lib/session/session";

interface CustomerRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  createdAt: string;
  isActive: boolean;
  orderCount: number;
  totalSpent: string;
}

interface CustomerPage {
  items: CustomerRow[];
  page: number;
  pageSize: number;
  total: number;
}

const PAGE_SIZE = 20;

/** Customers, with their paid-order count and total spent. Only paid orders count toward the totals. */
export default function CustomersPage() {
  const [draft, setDraft] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<CustomerPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (term) params.set("q", term);
    setResult(null);
    authorizedRequest<CustomerPage>(`/admin/customers?${params.toString()}`)
      .then(setResult)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Could not load customers.");
      });
  }, [term, page]);

  const search = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setTerm(draft.trim());
  };

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-xs tracking-[0.2em] text-gold-deep uppercase">Customers</p>
        <h1 className="mt-2 font-serif text-3xl text-brown">Customers</h1>
      </header>

      <form onSubmit={search} className="flex gap-3">
        <div className="flex-1">
          <TextInput
            aria-label="Search customers"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
            }}
            placeholder="Name or email"
            maxLength={100}
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {!result && !error ? <p className="text-sm text-muted">Loading customers…</p> : null}

      {result ? (
        <>
          <div className="overflow-x-auto rounded-md border border-line bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line bg-cream-deep/50 text-xs tracking-wide text-brown-soft uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Orders</th>
                  <th className="px-4 py-3 font-medium">Total spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted">
                      No customers match.
                    </td>
                  </tr>
                ) : (
                  result.items.map((customer) => (
                    <tr key={customer.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-brown">
                          {customer.firstName}
                          {customer.lastName ? ` ${customer.lastName}` : ""}
                        </p>
                        <p className="text-xs text-muted">
                          {customer.email}
                          {customer.phone ? ` · ${customer.phone}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-brown-soft">
                        {formatDate(customer.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-brown">{customer.orderCount}</td>
                      <td className="px-4 py-3 text-brown">{formatPrice(customer.totalSpent)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
            <p className="text-muted">
              Page {page} of {totalPages} · {result.total} customers
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
