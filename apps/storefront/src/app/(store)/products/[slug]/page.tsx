import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToBagButton } from "@/components/product/add-to-bag-button";
import { AvailabilityBadge } from "@/components/product/availability-badge";
import { ImageGallery } from "@/components/product/image-gallery";
import { ProductGrid } from "@/components/product/product-grid";
import { WishlistToggle } from "@/components/product/wishlist-toggle";
import { SITE } from "@/lib/config/site";
import { getProductDetail } from "@/lib/catalogue/queries";
import { formatPrice } from "@/lib/money";

export const revalidate = 60;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) return { title: "Product not found" };

  return {
    title: product.name,
    description: product.description.slice(0, 160),
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 160),
      images: product.images[0] ? [product.images[0].url] : [],
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) notFound();

  const primaryCategory = product.categories[0];
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.sku,
    image: product.images.map((image) => image.url),
    brand: { "@type": "Brand", name: SITE.name },
    offers: {
      "@type": "Offer",
      priceCurrency: SITE.currency,
      price: product.price,
      availability:
        product.availability === "OUT_OF_STOCK"
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <script
        type="application/ld+json"
        // JSON-LD must be inlined as text. Only our own catalogue data is serialised here.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />

      <nav aria-label="Breadcrumb" className="mb-8 text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-brown">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/shop" className="hover:text-brown">
              Shop
            </Link>
          </li>
          {primaryCategory ? (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={`/shop?category=${primaryCategory.slug}`} className="hover:text-brown">
                  {primaryCategory.name}
                </Link>
              </li>
            </>
          ) : null}
          <li aria-hidden="true">/</li>
          <li className="text-brown" aria-current="page">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="grid gap-6">
          <ImageGallery images={product.images} name={product.name} />
          {product.video ? (
            <video
              controls
              preload="metadata"
              poster={product.video.posterUrl ?? undefined}
              src={product.video.url}
              aria-label={"Video of "}
              className="aspect-video w-full rounded-md bg-sand"
            />
          ) : null}
        </div>

        <div className="flex flex-col">
          {product.categories.length > 0 ? (
            <p className="text-xs tracking-[0.2em] text-gold-deep uppercase">
              {product.categories.map((category) => category.name).join(" · ")}
            </p>
          ) : null}

          <h1 className="mt-3 font-serif text-3xl leading-tight text-brown sm:text-4xl">
            {product.name}
          </h1>
          {product.material ? <p className="mt-2 text-sm text-muted">{product.material}</p> : null}

          <div className="mt-6 flex flex-wrap items-baseline gap-3">
            <span className="font-serif text-2xl text-brown sm:text-3xl">
              {formatPrice(product.price)}
            </span>
            {product.compareAtPrice ? (
              <span className="text-base text-muted line-through">
                {formatPrice(product.compareAtPrice)}
              </span>
            ) : null}
            {product.discountPercent ? (
              <span className="rounded bg-brown px-2 py-1 text-xs tracking-wide text-cream">
                {product.discountPercent}% off
              </span>
            ) : null}
          </div>

          <div className="mt-4">
            <AvailabilityBadge availability={product.availability} />
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <AddToBagButton
              product={{
                id: product.id,
                slug: product.slug,
                name: product.name,
                image: product.images[0]?.url ?? null,
              }}
              availability={product.availability}
              className="flex-1"
            />
            <WishlistToggle slug={product.slug} name={product.name} className="sm:flex-1" />
          </div>

          <p className="mt-4 text-xs text-muted">
            Final price, delivery and payment are confirmed at checkout.
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-6 text-sm">
            <dt className="text-muted">SKU</dt>
            <dd className="text-brown">{product.sku}</dd>
            {product.weightGrams ? (
              <>
                <dt className="text-muted">Approx. weight</dt>
                <dd className="text-brown">{product.weightGrams} g</dd>
              </>
            ) : null}
          </dl>

          <div className="mt-8 border-t border-line pt-6">
            <h2 className="font-serif text-xl text-brown">About this piece</h2>
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-brown-soft">
              {product.description}
            </p>
          </div>
        </div>
      </div>

      {product.related.length > 0 ? (
        <section aria-labelledby="related-heading" className="mt-24">
          <h2 id="related-heading" className="mb-8 text-center font-serif text-3xl text-brown">
            You may also like
          </h2>
          <ProductGrid products={product.related} emptyMessage="" />
        </section>
      ) : null}
    </div>
  );
}
