import type { Metadata } from "next";

import { BagView } from "@/components/bag/bag-view";

export const metadata: Metadata = {
  title: "Your bag",
  robots: { index: false, follow: false },
};

export default function BagPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="mb-10 font-serif text-4xl text-brown sm:text-5xl">Your bag</h1>
      <BagView />
    </div>
  );
}
