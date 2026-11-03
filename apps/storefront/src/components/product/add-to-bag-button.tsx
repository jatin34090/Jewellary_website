"use client";

import { useState } from "react";

import { addLine, bagStore } from "@/lib/bag/bag";
import type { Availability } from "@/lib/api/types";

interface AddToBagButtonProps {
  product: { id: string; slug: string; name: string; image: string | null };
  availability: Availability;
  className?: string;
}

export function AddToBagButton({ product, availability, className = "" }: AddToBagButtonProps) {
  const [justAdded, setJustAdded] = useState(false);
  const unavailable = availability === "OUT_OF_STOCK";

  const handleClick = () => {
    bagStore.update((lines) =>
      addLine(lines, {
        slug: product.slug,
        productId: product.id,
        name: product.name,
        image: product.image,
      }),
    );
    setJustAdded(true);
    window.setTimeout(() => {
      setJustAdded(false);
    }, 2000);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={unavailable}
      aria-live="polite"
      className={`inline-flex items-center justify-center rounded bg-brown px-6 py-3.5 text-sm font-medium tracking-[0.12em] text-cream uppercase transition-colors hover:bg-brown-soft disabled:cursor-not-allowed disabled:bg-sand disabled:text-muted ${className}`}
    >
      {unavailable ? "Currently unavailable" : justAdded ? "Added to your bag" : "Add to bag"}
    </button>
  );
}
