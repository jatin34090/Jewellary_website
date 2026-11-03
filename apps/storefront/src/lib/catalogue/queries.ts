import "server-only";

import { apiGet, apiGetOrNull } from "../api/client";
import type {
  CatalogueSort,
  CategoryNode,
  CursorPage,
  ProductDetail,
  ProductSummary,
} from "../api/types";
import { toQueryString } from "./query-string";

/** Catalogue pages revalidate every minute: fresh enough for stock and prices, cheap for the API. */
const CATALOGUE_REVALIDATE = 60;

export interface ProductQuery {
  q?: string | undefined;
  category?: string | undefined;
  minPrice?: string | undefined;
  maxPrice?: string | undefined;
  sort?: CatalogueSort | undefined;
  featured?: boolean | undefined;
  limit?: number | undefined;
  cursor?: string | undefined;
}

export function getCategoryTree(): Promise<CategoryNode[]> {
  return apiGet<CategoryNode[]>("/categories", { revalidate: 300 });
}

export function getProductPage(query: ProductQuery): Promise<CursorPage<ProductSummary>> {
  return apiGet<CursorPage<ProductSummary>>(`/products${toQueryString({ ...query })}`, {
    revalidate: CATALOGUE_REVALIDATE,
  });
}

/**
 * Returns null when the product is missing or not published, so the page can show a 404.
 * Not cached: a cached copy could show a product that was just archived, or a stale price or stock status.
 * Listings keep the short cache window. Product detail gets API-side caching in Phase 7.
 */
export function getProductDetail(slug: string): Promise<ProductDetail | null> {
  return apiGetOrNull<ProductDetail>(`/products/${encodeURIComponent(slug)}`, { revalidate: 0 });
}

/**
 * Runs a catalogue read and falls back to an empty value if the API is unreachable.
 * A single failing section should not take the whole homepage down with it.
 */
export async function withFallback<T>(
  read: () => Promise<T>,
  fallback: T,
  label: string,
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    console.error(`[catalogue] ${label} unavailable`, error);
    return fallback;
  }
}
