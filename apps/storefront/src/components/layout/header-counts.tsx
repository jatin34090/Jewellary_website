"use client";

import Link from "next/link";

import { bagStore, countItems } from "@/lib/bag/bag";
import { useLocalStore } from "@/lib/storage/use-local-store";
import { wishlistStore } from "@/lib/wishlist/wishlist";

/** Live counts for the bag and wishlist. Starts at zero on the server and fills in after hydration. */
export function HeaderCounts() {
  const bag = useLocalStore(bagStore);
  const wishlist = useLocalStore(wishlistStore);

  return (
    <>
      <Link
        href="/wishlist"
        className="rounded px-3 py-2 text-sm text-brown transition-colors hover:bg-cream-deep"
      >
        Wishlist <span className="tabular-nums text-gold-deep">({wishlist.length})</span>
      </Link>
      <Link
        href="/bag"
        className="rounded bg-brown px-4 py-2 text-sm text-cream transition-colors hover:bg-brown-soft"
      >
        Bag <span className="tabular-nums">({countItems(bag)})</span>
      </Link>
    </>
  );
}
