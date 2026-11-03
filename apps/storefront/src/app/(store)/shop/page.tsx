import type { Metadata } from "next";

import { LoadMore } from "@/components/shop/load-more";
import { ShopFilters, type ShopFilterValues } from "@/components/shop/shop-filters";
import { ProductGrid } from "@/components/product/product-grid";
import { ApiError } from "@/lib/api/errors";
import type { CatalogueSort, CategoryNode } from "@/lib/api/types";
import {
  getCategoryTree,
  getProductPage,
  withFallback,
  type ProductQuery,
} from "@/lib/catalogue/queries";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Shop",
  description: "Browse every piece in the VRINOOR collection by category, price and style.",
};

const PAGE_SIZE = 24;
const SORTS: CatalogueSort[] = ["newest", "best_selling", "price_asc", "price_desc"];
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MONEY_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Reads and sanitises the URL filters. Invalid values are dropped rather than sent to the API. */
function readFilters(params: Record<string, string | string[] | undefined>) {
  const text = (key: string): string => {
    const value = params[key];
    return typeof value === "string" ? value.trim() : "";
  };

  const sortValue = text("sort");
  const sort: CatalogueSort = (SORTS as string[]).includes(sortValue)
    ? (sortValue as CatalogueSort)
    : "newest";
  const category = SLUG_PATTERN.test(text("category")) ? text("category") : "";
  const minPrice = MONEY_PATTERN.test(text("minPrice")) ? text("minPrice") : "";
  const maxPrice = MONEY_PATTERN.test(text("maxPrice")) ? text("maxPrice") : "";

  const values: ShopFilterValues = {
    q: text("q").slice(0, 100),
    category,
    minPrice,
    maxPrice,
    sort,
  };
  const featured = text("featured") === "true";

  return { values, featured };
}

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { values, featured } = readFilters(params);

  const query: ProductQuery = {
    q: values.q || undefined,
    category: values.category || undefined,
    minPrice: values.minPrice || undefined,
    maxPrice: values.maxPrice || undefined,
    sort: values.sort,
    featured: featured || undefined,
    limit: PAGE_SIZE,
  };

  const [categories, page] = await Promise.all([
    withFallback<CategoryNode[]>(getCategoryTree, [], "categories"),
    getProductPage(query).then(
      (result) => ({ result, error: null as string | null }),
      (error: unknown) => ({
        result: { items: [], nextCursor: null },
        error:
          error instanceof ApiError && error.status === 400
            ? "Some filters are not valid. Check the price range and try again."
            : "We could not load the collection right now. Please try again shortly.",
      }),
    ),
  ]);

  const heading = featured
    ? "Featured pieces"
    : values.category
      ? (findCategoryName(categories, values.category) ?? "Shop")
      : values.q
        ? `Results for “${values.q}”`
        : "The collection";

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <p className="mb-2 text-xs tracking-[0.25em] text-gold-deep uppercase">Shop</p>
        <h1 className="font-serif text-4xl text-brown sm:text-5xl">{heading}</h1>
      </header>

      <ShopFilters values={values} categories={categories} featured={featured} />

      {page.error ? (
        <p
          role="alert"
          className="mt-10 rounded-md border border-gold/40 bg-cream-deep px-5 py-4 text-sm text-brown"
        >
          {page.error}
        </p>
      ) : (
        <div className="mt-10">
          {page.result.items.length === 0 ? (
            <ProductGrid
              products={[]}
              emptyMessage="No pieces match these filters yet. Try clearing a filter."
            />
          ) : (
            // LoadMore renders the grid itself. Keyed on the filters, so a new search starts from its own first page.
            <LoadMore
              key={JSON.stringify(query)}
              query={{
                q: query.q,
                category: query.category,
                minPrice: query.minPrice,
                maxPrice: query.maxPrice,
                sort: query.sort,
                featured: query.featured,
                limit: PAGE_SIZE,
              }}
              initialItems={page.result.items}
              initialCursor={page.result.nextCursor}
            />
          )}
        </div>
      )}
    </div>
  );
}

function findCategoryName(categories: CategoryNode[], slug: string): string | undefined {
  for (const node of categories) {
    if (node.slug === slug) return node.name;
    const child = node.children.find((item) => item.slug === slug);
    if (child) return child.name;
  }
  return undefined;
}
