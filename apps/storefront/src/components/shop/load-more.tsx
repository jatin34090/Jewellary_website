"use client";

import { useState } from "react";

import { browserGet } from "@/lib/api/browser-client";
import type { CursorPage, ProductSummary } from "@/lib/api/types";
import { toQueryString } from "@/lib/catalogue/query-string";
import { ProductCard } from "@/components/product/product-card";

interface LoadMoreProps {
  /** The active filters, as sent to the API. The cursor is added on each request. */
  query: Record<string, string | number | boolean | undefined>;
  initialItems: ProductSummary[];
  initialCursor: string | null;
}

/** Appends the next page of products in the browser, using the cursor from the previous page. */
export function LoadMore({ query, initialItems, initialCursor }: LoadMoreProps) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNext = async () => {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const page = await browserGet<CursorPage<ProductSummary>>(
        `/products${toQueryString({ ...query, cursor })}`,
      );
      setItems((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setError("We could not load more pieces. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-12">
      <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
        {items.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" className="mt-6 text-center text-sm text-gold-deep">
          {error}
        </p>
      ) : null}

      {cursor ? (
        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={() => void loadNext()}
            disabled={loading}
            className="rounded border border-brown/30 px-8 py-3 text-sm tracking-[0.15em] text-brown uppercase transition-colors hover:border-brown disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
