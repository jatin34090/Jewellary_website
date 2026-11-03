"use client";

import Link from "next/link";
import { useEffect } from "react";

import { ProductCard } from "@/components/product/product-card";
import { useProductsBySlugs } from "@/lib/catalogue/use-products-by-slug";
import { useLocalStore } from "@/lib/storage/use-local-store";
import { wishlistStore } from "@/lib/wishlist/wishlist";

export function WishlistView() {
  const slugs = useLocalStore(wishlistStore);
  const { loading, products } = useProductsBySlugs(slugs);

  // Once lookups finish, drop saved pieces that no longer exist, so the wishlist does not fill with dead links.
  const missingKey = slugs.filter((slug) => products[slug] === "missing").join(",");
  useEffect(() => {
    if (!loading && missingKey) {
      const missing = missingKey.split(",");
      wishlistStore.update((current) => current.filter((slug) => !missing.includes(slug)));
    }
  }, [loading, missingKey]);

  if (slugs.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="font-serif text-2xl text-brown">Your wishlist is empty.</p>
        <p className="mt-3 text-sm text-muted">Tap the heart on any piece to save it here.</p>
        <Link
          href="/shop"
          className="mt-8 inline-flex rounded bg-brown px-8 py-3.5 text-sm tracking-[0.15em] text-cream uppercase hover:bg-brown-soft"
        >
          Browse the collection
        </Link>
      </div>
    );
  }

  if (loading) {
    return <p className="py-20 text-center text-sm text-muted">Loading your pieces…</p>;
  }

  const available = slugs.flatMap((slug) => {
    const product = products[slug];
    return product && typeof product !== "string" ? [product] : [];
  });
  const failed = slugs.filter((slug) => products[slug] === "error").length;

  return (
    <div>
      {failed > 0 ? (
        <p role="alert" className="mb-6 text-sm text-gold-deep">
          {failed} saved {failed === 1 ? "piece" : "pieces"} could not be loaded. Refresh to try
          again.
        </p>
      ) : null}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
        {available.map((product) => (
          <li key={product.slug}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </div>
  );
}
