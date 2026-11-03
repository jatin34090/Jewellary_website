"use client";

import { useEffect, useState } from "react";

import { browserGet } from "../api/browser-client";
import { ApiError } from "../api/errors";
import type { ProductDetail } from "../api/types";

/** `missing`: the product is gone or unpublished. `error`: the request failed, so retry later. */
export type ProductLookup = ProductDetail | "missing" | "error";

interface LookupState {
  key: string;
  products: Record<string, ProductLookup>;
}

/**
 * Loads current prices and availability for a list of product slugs.
 * Stored bag and wishlist entries only hold identifiers, so this is where fresh data comes from.
 */
export function useProductsBySlugs(slugs: string[]): {
  loading: boolean;
  products: Record<string, ProductLookup>;
} {
  // A stable string key means the effect runs only when the list of slugs actually changes.
  const key = slugs.join(",");
  const [state, setState] = useState<LookupState | null>(null);

  useEffect(() => {
    const list = key ? key.split(",") : [];
    if (list.length === 0) return;

    let active = true;
    void Promise.all(
      list.map(async (slug): Promise<[string, ProductLookup]> => {
        try {
          return [slug, await browserGet<ProductDetail>(`/products/${encodeURIComponent(slug)}`)];
        } catch (error) {
          return [slug, error instanceof ApiError && error.status === 404 ? "missing" : "error"];
        }
      }),
    ).then((entries) => {
      if (active) setState({ key, products: Object.fromEntries(entries) });
    });

    return () => {
      active = false;
    };
  }, [key]);

  if (key === "") return { loading: false, products: {} };
  if (!state || state.key !== key) return { loading: true, products: {} };
  return { loading: false, products: state.products };
}
