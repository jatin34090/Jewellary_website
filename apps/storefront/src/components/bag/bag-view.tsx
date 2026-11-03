"use client";

import Image from "next/image";
import Link from "next/link";

import { AvailabilityBadge } from "@/components/product/availability-badge";
import {
  bagStore,
  countItems,
  removeLine,
  setLineQuantity,
  MAX_LINE_QUANTITY,
  type BagLine,
} from "@/lib/bag/bag";
import { formatPaise, formatPrice, toPaise } from "@/lib/money";
import { useLocalStore } from "@/lib/storage/use-local-store";
import { useProductsBySlugs } from "@/lib/catalogue/use-products-by-slug";

export function BagView() {
  const lines = useLocalStore(bagStore);
  const slugs = lines.map((line) => line.slug);
  const { loading, products } = useProductsBySlugs(slugs);

  if (lines.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="font-serif text-2xl text-brown">Your bag is empty.</p>
        <p className="mt-3 text-sm text-muted">
          Find a piece you love and it will wait for you here.
        </p>
        <Link
          href="/shop"
          className="mt-8 inline-flex rounded bg-brown px-8 py-3.5 text-sm tracking-[0.15em] text-cream uppercase hover:bg-brown-soft"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  // Subtotal uses fresh prices, and only items that can currently be bought.
  let subtotalPaise = 0;
  let purchasable = 0;
  for (const line of lines) {
    const product = products[line.slug];
    if (product && typeof product !== "string" && product.availability !== "OUT_OF_STOCK") {
      subtotalPaise += toPaise(product.price) * line.quantity;
      purchasable += line.quantity;
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <section aria-label="Items in your bag">
        <p className="mb-4 text-sm text-muted">
          {countItems(lines)} {countItems(lines) === 1 ? "piece" : "pieces"}
        </p>
        <ul className="divide-y divide-line border-y border-line">
          {lines.map((line) => (
            <BagRow key={line.slug} line={line} lookup={products[line.slug]} loading={loading} />
          ))}
        </ul>
      </section>

      <aside className="h-fit rounded-md border border-line bg-cream-deep/60 p-6 lg:sticky lg:top-40">
        <h2 className="font-serif text-2xl text-brown">Summary</h2>
        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal ({purchasable} available)</dt>
            <dd className="text-brown">{loading ? "…" : formatPaise(subtotalPaise)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Delivery</dt>
            <dd className="text-muted">Calculated at checkout</dd>
          </div>
        </dl>
        <div className="mt-6 border-t border-line pt-4 text-xs text-muted">
          Prices and stock are checked again when you place your order.
        </div>
        <button
          type="button"
          disabled
          className="mt-6 w-full rounded bg-brown px-6 py-3.5 text-sm tracking-[0.15em] text-cream uppercase opacity-50"
        >
          Checkout (coming soon)
        </button>
        <Link
          href="/shop"
          className="mt-4 block text-center text-sm text-brown-soft underline-offset-4 hover:underline"
        >
          Continue shopping
        </Link>
      </aside>
    </div>
  );
}

function BagRow({
  line,
  lookup,
  loading,
}: {
  line: BagLine;
  lookup: BagLookup | undefined;
  loading: boolean;
}) {
  const product = lookup && typeof lookup !== "string" ? lookup : null;
  const unavailable = lookup === "missing";

  return (
    <li className="flex gap-4 py-5 sm:gap-6">
      <Link
        href={`/products/${line.slug}`}
        className="relative size-24 shrink-0 overflow-hidden rounded bg-sand sm:size-28"
      >
        {line.image ? (
          <Image src={line.image} alt={line.name} fill sizes="112px" className="object-cover" />
        ) : null}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex justify-between gap-4">
          <Link
            href={`/products/${line.slug}`}
            className="font-serif text-lg text-brown hover:text-gold-deep"
          >
            {line.name}
          </Link>
          <p className="shrink-0 text-sm text-brown">
            {product && !loading ? formatPrice(product.price) : ""}
          </p>
        </div>

        {unavailable ? (
          <p className="text-sm text-gold-deep">This piece is no longer available.</p>
        ) : lookup === "error" ? (
          <p className="text-sm text-gold-deep">
            We could not check this piece. Refresh to try again.
          </p>
        ) : product ? (
          <AvailabilityBadge availability={product.availability} />
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-4">
          {unavailable ? null : (
            <div
              className="inline-flex items-center rounded border border-line bg-white"
              role="group"
              aria-label={`Quantity for ${line.name}`}
            >
              <button
                type="button"
                className="size-9 text-lg text-brown hover:bg-cream-deep"
                aria-label="Decrease quantity"
                onClick={() => {
                  bagStore.update((lines) => setLineQuantity(lines, line.slug, line.quantity - 1));
                }}
                disabled={line.quantity <= 1}
              >
                −
              </button>
              <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">
                {line.quantity}
              </span>
              <button
                type="button"
                className="size-9 text-lg text-brown hover:bg-cream-deep disabled:opacity-40"
                aria-label="Increase quantity"
                onClick={() => {
                  bagStore.update((lines) => setLineQuantity(lines, line.slug, line.quantity + 1));
                }}
                disabled={line.quantity >= MAX_LINE_QUANTITY}
              >
                +
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              bagStore.update((lines) => removeLine(lines, line.slug));
            }}
            className="text-xs text-muted underline-offset-4 hover:text-brown hover:underline"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

type BagLookup = ReturnType<typeof useProductsBySlugs>["products"][string];
