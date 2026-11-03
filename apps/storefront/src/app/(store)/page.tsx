import Link from "next/link";
import type { ReactNode } from "react";

import { CategoryTiles } from "@/components/home/category-tiles";
import { Hero } from "@/components/home/hero";
import { SectionHeading } from "@/components/home/section-heading";
import { ProductGrid } from "@/components/product/product-grid";
import type { CategoryNode, CursorPage, ProductSummary } from "@/lib/api/types";
import { getCategoryTree, getProductPage, withFallback } from "@/lib/catalogue/queries";
import {
  getHeroBanners,
  getStoreSettings,
  type HomeSectionId,
  type StorePublicSettings,
} from "@/lib/store/queries";

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

const EMPTY_PAGE: CursorPage<ProductSummary> = { items: [], nextCursor: null };

export default async function HomePage() {
  const [settings, banners, categories, featured, newArrivals, bestSellers] = await Promise.all([
    getStoreSettings(),
    getHeroBanners(),
    withFallback<CategoryNode[]>(getCategoryTree, [], "categories"),
    withFallback(
      () => getProductPage({ featured: true, sort: "newest", limit: 4 }),
      EMPTY_PAGE,
      "featured",
    ),
    withFallback(() => getProductPage({ sort: "newest", limit: 8 }), EMPTY_PAGE, "new arrivals"),
    withFallback(
      () => getProductPage({ sort: "best_selling", limit: 8 }),
      EMPTY_PAGE,
      "best sellers",
    ),
  ]);

  const data: Record<Exclude<HomeSectionId, "hero" | "categories" | "why">, ProductSummary[]> = {
    featured: featured.items,
    newArrivals: newArrivals.items,
    bestSellers: bestSellers.items,
  };

  // The admin panel decides which sections show and in what order.
  const sections = settings.homeSections.filter((section) => section.enabled);

  return (
    <>
      {sections.map((section) => (
        <HomeSection
          key={section.id}
          id={section.id}
          settings={settings}
          banner={banners[0]}
          categories={categories}
          products={section.id in data ? data[section.id as keyof typeof data] : []}
        />
      ))}
    </>
  );
}

function HomeSection({
  id,
  settings,
  banner,
  categories,
  products,
}: {
  id: HomeSectionId;
  settings: StorePublicSettings;
  banner: Parameters<typeof Hero>[0]["banner"];
  categories: CategoryNode[];
  products: ProductSummary[];
}): ReactNode {
  switch (id) {
    case "hero":
      return <Hero tagline={settings.brand.tagline} banner={banner} />;
    case "categories":
      return (
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
      );
    case "featured":
      return (
        <ProductSection
          title="Featured pieces"
          eyebrow="Edit"
          products={products}
          href="/shop?featured=true"
          emptyMessage="Featured pieces will appear here soon."
        />
      );
    case "newArrivals":
      return (
        <ProductSection
          title="New arrivals"
          eyebrow="Just in"
          products={products}
          href="/shop?sort=newest"
          emptyMessage="New pieces are on their way."
          tone="cream-deep"
        />
      );
    case "bestSellers":
      return (
        <ProductSection
          title="Best sellers"
          eyebrow="Loved by many"
          products={products}
          href="/shop?sort=best_selling"
          emptyMessage="Our best sellers will appear here soon."
        />
      );
    case "why":
      return (
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
      );
  }
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
  const headingId = `${title.replace(/\s+/g, "-").toLowerCase()}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className={`px-4 py-16 sm:px-6 ${tone === "cream-deep" ? "bg-cream-deep/60" : ""}`}
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeading id={headingId} eyebrow={eyebrow} title={title} />
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
