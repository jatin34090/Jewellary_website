import type { Metadata } from "next";

import { WishlistView } from "@/components/wishlist/wishlist-view";

export const metadata: Metadata = {
  title: "Your wishlist",
  robots: { index: false, follow: false },
};

export default function WishlistPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="mb-10 font-serif text-4xl text-brown sm:text-5xl">Your wishlist</h1>
      <WishlistView />
    </div>
  );
}
