"use client";

import { toggleWishlist, wishlistStore } from "@/lib/wishlist/wishlist";
import { useLocalStore } from "@/lib/storage/use-local-store";

interface WishlistToggleProps {
  slug: string;
  name: string;
  className?: string;
}

export function WishlistToggle({ slug, name, className = "" }: WishlistToggleProps) {
  const saved = useLocalStore(wishlistStore).includes(slug);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
      onClick={() => {
        wishlistStore.update((slugs) => toggleWishlist(slugs, slug));
      }}
      className={`inline-flex items-center justify-center gap-2 rounded border px-4 py-3 text-sm transition-colors ${
        saved
          ? "border-gold bg-gold/15 text-brown"
          : "border-brown/25 text-brown hover:border-brown"
      } ${className}`}
    >
      <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
      {saved ? "Saved to wishlist" : "Add to wishlist"}
    </button>
  );
}
