import Link from "next/link";

import type { CategoryNode } from "@/lib/api/types";

export function CategoryTiles({ categories }: { categories: CategoryNode[] }) {
  if (categories.length === 0) return null;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {categories.map((category) => (
        <li key={category.id}>
          <Link
            href={`/shop?category=${category.slug}`}
            className="group flex h-full min-h-24 items-center justify-center rounded-md border border-line bg-sand px-4 py-6 text-center font-serif text-lg text-brown transition-colors hover:bg-brown hover:text-cream"
          >
            {category.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
