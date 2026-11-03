"use client";

import Link from "next/link";
import { useEffect, useState, type SyntheticEvent } from "react";

import { Button, Field, Notice, SelectInput, TextInput } from "@/components/ui/form";
import type { AdminProductPage, AdminProduct } from "@/components/admin/types";
import { ApiError } from "@/lib/api/errors";
import { formatPrice } from "@/lib/money";
import { authorizedRequest } from "@/lib/session/session";

const PAGE_SIZE = 20;

export default function ProductsPage() {
  const [query, setQuery] = useState({ q: "", status: "" });
  const [draft, setDraft] = useState({ q: "", status: "" });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AdminProductPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (query.q) params.set("q", query.q);
    if (query.status) params.set("status", query.status);
    setResult(null);
    authorizedRequest<AdminProductPage>(`/admin/products?${params.toString()}`)
      .then(setResult)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Could not load products.");
      });
  }, [query, page]);

  const search = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setQuery({ q: draft.q.trim(), status: draft.status });
  };

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-gold-deep uppercase">Catalogue</p>
          <h1 className="mt-2 font-serif text-3xl text-brown">Products</h1>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center rounded bg-brown px-5 py-2.5 text-sm tracking-[0.1em] text-cream uppercase hover:bg-brown-soft"
        >
          New product
        </Link>
      </header>

      <form
        onSubmit={search}
        className="grid gap-3 rounded-md border border-line bg-white p-4 sm:grid-cols-[1fr_200px_auto] sm:items-end"
      >
        <Field label="Search" htmlFor="p-q">
          <TextInput
            id="p-q"
            value={draft.q}
            onChange={(e) => {
              setDraft({ ...draft, q: e.target.value });
            }}
            placeholder="Name or SKU"
            maxLength={100}
          />
        </Field>
        <Field label="Status" htmlFor="p-status">
          <SelectInput
            id="p-status"
            value={draft.status}
            onChange={(e) => {
              setDraft({ ...draft, status: e.target.value });
            }}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Live</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </SelectInput>
        </Field>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {!result && !error ? <p className="text-sm text-muted">Loading products…</p> : null}

      {result ? (
        <>
          <div className="overflow-x-auto rounded-md border border-line bg-white">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line bg-cream-deep/50 text-xs tracking-wide text-brown-soft uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Media</th>
                  <th className="px-4 py-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted">
                      No products match these filters.
                    </td>
                  </tr>
                ) : (
                  result.items.map((product) => <ProductRow key={product.id} product={product} />)
                )}
              </tbody>
            </table>
          </div>

          <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
            <p className="text-muted">
              Page {page} of {totalPages} · {result.total} products
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

function ProductRow({ product }: { product: AdminProduct }) {
  const inv = product.inventory;
  const statusLabel =
    product.status === "ACTIVE" ? "Live" : product.status === "DRAFT" ? "Draft" : "Archived";
  return (
    <tr className="align-middle">
      <td className="px-4 py-3">
        <p className="font-medium text-brown">{product.name}</p>
        <p className="text-xs text-muted">{product.sku}</p>
      </td>
      <td className="px-4 py-3 text-brown">{formatPrice(product.price)}</td>
      <td className="px-4 py-3 text-brown-soft">
        {inv ? (
          <>
            {inv.quantityOnHand - inv.quantityReserved} sellable
            <span className="block text-xs text-muted">
              {inv.quantityOnHand} on hand · {inv.quantityReserved} reserved
            </span>
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded px-2 py-1 text-xs ${product.status === "ACTIVE" ? "bg-brown text-cream" : "bg-cream-deep text-brown-soft"}`}
        >
          {statusLabel}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-muted">
        {product.images.length} photo{product.images.length === 1 ? "" : "s"}
        {product.videoUrl ? " · video" : ""}
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/admin/products/${product.id}`}
          className="text-brown underline-offset-4 hover:underline"
        >
          Edit
        </Link>
      </td>
    </tr>
  );
}
