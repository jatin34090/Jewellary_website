import Link from "next/link";

import type { CatalogueSort, CategoryNode } from "@/lib/api/types";

export interface ShopFilterValues {
  q: string;
  category: string;
  minPrice: string;
  maxPrice: string;
  sort: CatalogueSort;
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "best_selling", label: "Best selling" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

/**
 * A plain GET form. It works without JavaScript, and the filters stay in the URL, so results can be shared.
 */
export function ShopFilters({
  values,
  categories,
  featured,
}: {
  values: ShopFilterValues;
  categories: CategoryNode[];
  featured: boolean;
}) {
  const flattened = categories.flatMap((node) => [node, ...node.children]);

  return (
    <form
      action="/shop"
      method="get"
      className="grid gap-4 rounded-md border border-line bg-cream-deep/50 p-4 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] md:items-end"
    >
      {featured ? <input type="hidden" name="featured" value="true" /> : null}

      <Field label="Search" htmlFor="q">
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={values.q}
          placeholder="Ring, aurora, gold…"
          maxLength={100}
          className={inputClass}
        />
      </Field>

      <Field label="Category" htmlFor="category">
        <select id="category" name="category" defaultValue={values.category} className={inputClass}>
          <option value="">All categories</option>
          {flattened.map((node) => (
            <option key={node.id} value={node.slug}>
              {node.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Min price (₹)" htmlFor="minPrice">
        <input
          id="minPrice"
          name="minPrice"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          defaultValue={values.minPrice}
          className={inputClass}
        />
      </Field>

      <Field label="Max price (₹)" htmlFor="maxPrice">
        <input
          id="maxPrice"
          name="maxPrice"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          defaultValue={values.maxPrice}
          className={inputClass}
        />
      </Field>

      <Field label="Sort by" htmlFor="sort">
        <select id="sort" name="sort" defaultValue={values.sort} className={inputClass}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 rounded bg-brown px-5 py-2.5 text-sm tracking-wide text-cream uppercase hover:bg-brown-soft md:flex-none"
        >
          Apply
        </button>
        <Link
          href="/shop"
          className="rounded border border-brown/25 px-4 py-2.5 text-sm text-brown hover:border-brown"
        >
          Clear
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs tracking-wide text-brown-soft uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded border border-line bg-white px-3 py-2.5 text-sm text-brown focus:border-gold focus:outline-none";
