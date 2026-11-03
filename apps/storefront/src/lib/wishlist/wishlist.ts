import { createLocalStore } from "../storage/local-store";

export const MAX_WISHLIST_ITEMS = 100;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Stores product slugs only. Details are fetched when the wishlist is shown. */
export function parseWishlist(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set<string>();
  for (const entry of raw) {
    if (unique.size >= MAX_WISHLIST_ITEMS) break;
    if (typeof entry === "string" && SLUG_PATTERN.test(entry)) unique.add(entry);
  }
  return [...unique];
}

export function toggleWishlist(slugs: string[], slug: string): string[] {
  return slugs.includes(slug)
    ? slugs.filter((item) => item !== slug)
    : [...slugs, slug].slice(-MAX_WISHLIST_ITEMS);
}

export const wishlistStore = createLocalStore<string[]>({
  key: "vrinoor_wishlist",
  empty: [],
  parse: parseWishlist,
});
