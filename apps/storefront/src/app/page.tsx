import Link from "next/link";

import { CategoryTiles } from "@/components/home/category-tiles";
import { Hero } from "@/components/home/hero";
import { SectionHeading } from "@/components/home/section-heading";
import { ProductGrid } from "@/components/product/product-grid";
import type { CategoryNode, ProductSummary } from "@/lib/api/types";
import { getCategoryTree, getProductPage, withFallback } from "@/lib/catalogue/queries";

export const revalidate = 60;

const WHY_VRINOOR = [
  { title: "Elegant designs", text: "Pieces made to be worn every day and remembered for years." },
  {
    title: "Carefully selected",
    text: "Every piece is checked for finish, detail and comfort before it reaches you.",
  },
  {
    title: "Made for you",
    text: "Choose a piece for a celebration, a gift, or simply for yourself.",
  },
];

export default async function HomePage() {
  const [categories, featured, newArrivals, bestSellers] = await Promise.all([
    withFallback<CategoryNode[]>(getCategoryTree, [], "categories"),
    withFallback(
      () => getProductPage({ featured: true, sort: "newest", limit: 4 }),
      { items: [], nextCursor: null },
      "featured",
    ),
    withFallback(
      () => getProductPage({ sort: "newest", limit: 8 }),
      { items: [], nextCursor: null },
      "new arrivals",
    ),
    withFallback(
      () => getProductPage({ sort: "best_selling", limit: 8 }),
      { items: [], nextCursor: null },
      "best sellers",
    ),
  ]);

  return (
    <>
      <Hero />

      <section
        aria-labelledby="categories-heading"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6"
      >
        <SectionHeading
          id="categories-heading"
          eyebrow="Explore"
          title="Shop by category"
          description="Find something beautiful for every moment."
        />
        <CategoryTiles categories={categories} />
      </section>

      <ProductSection
        title="Featured pieces"
        eyebrow="Edit"
        products={featured.items}
        href="/shop?featured=true"
        emptyMessage="Featured pieces will appear here soon."
      />

      <ProductSection
        title="New arrivals"
        eyebrow="Just in"
        products={newArrivals.items}
        href="/shop?sort=newest"
        emptyMessage="New pieces are on their way."
        tone="cream-deep"
      />

      <ProductSection
        title="Best sellers"
        eyebrow="Loved by many"
        products={bestSellers.items}
        href="/shop?sort=best_selling"
        emptyMessage="Our best sellers will appear here soon."
      />

      <section aria-labelledby="why-heading" className="bg-cream-deep/60 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            id="why-heading"
            eyebrow="Our promise"
            title="Why VRINOOR?"
            description="Elegance in every detail. Noor in every moment."
          />
          <ul className="grid gap-6 md:grid-cols-3">
            {WHY_VRINOOR.map((item) => (
              <li
                key={item.title}
                className="rounded-md border border-line bg-cream p-8 text-center"
              >
                <p aria-hidden="true" className="mb-3 text-gold-deep">
                  ✦
                </p>
                <h3 className="font-serif text-xl text-brown">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{item.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

function ProductSection({
  title,
  eyebrow,
  products,
  href,
  emptyMessage,
  tone,
}: {
  title: string;
  eyebrow: string;
  products: ProductSummary[];
  href: string;
  emptyMessage: string;
  tone?: "cream-deep";
}) {
  // Hide a section that has nothing to show, rather than leaving an empty block on the homepage.
  if (products.length === 0) return null;

  return (
    <section
      aria-labelledby={`${title.replace(/\s+/g, "-").toLowerCase()}-heading`}
      className={`px-4 py-16 sm:px-6 ${tone === "cream-deep" ? "bg-cream-deep/60" : ""}`}
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          id={`${title.replace(/\s+/g, "-").toLowerCase()}-heading`}
          eyebrow={eyebrow}
          title={title}
        />
        <ProductGrid products={products} emptyMessage={emptyMessage} />
        <div className="mt-12 text-center">
          <Link
            href={href}
            className="inline-flex items-center rounded border border-brown/30 px-7 py-3 text-sm tracking-[0.15em] text-brown uppercase transition-colors hover:border-brown"
          >
            View all
          </Link>
        </div>
      </div>
    </section>
  );
}
