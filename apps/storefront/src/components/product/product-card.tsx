import Link from "next/link";
import Image from "next/image";

import { formatPrice } from "@/lib/money";
import type { ProductSummary } from "@/lib/api/types";
import { AvailabilityBadge } from "./availability-badge";
import { WishlistToggle } from "./wishlist-toggle";

/** Product tile for grids. Works on the server and in client components. */
export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductSummary;
  priority?: boolean;
}) {
  const image = product.primaryImage;

  return (
    <article className="group relative flex flex-col">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-square overflow-hidden rounded-md bg-sand"
      >
        {image ? (
          <Image
            src={image.url}
            alt={image.altText ?? product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            priority={priority}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full items-center justify-center font-serif text-sm text-muted">
            {product.name}
          </span>
        )}
        {product.discountPercent ? (
          <span className="absolute left-2 top-2 rounded bg-brown px-2 py-1 text-[11px] tracking-wide text-cream">
            {product.discountPercent}% off
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 pt-3">
        <h3 className="text-[15px] leading-snug text-brown">
          <Link href={`/products/${product.slug}`} className="hover:text-gold-deep">
            {product.name}
          </Link>
        </h3>
        {product.material ? <p className="text-xs text-muted">{product.material}</p> : null}
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-medium text-brown">{formatPrice(product.price)}</span>
          {product.compareAtPrice ? (
            <span className="text-xs text-muted line-through">
              {formatPrice(product.compareAtPrice)}
            </span>
          ) : null}
        </div>
        <AvailabilityBadge availability={product.availability} />
        <WishlistToggle
          slug={product.slug}
          name={product.name}
          className="mt-auto w-full py-2 text-xs"
        />
      </div>
    </article>
  );
}
