import type { ProductSummary } from "@/lib/api/types";
import { ProductCard } from "./product-card";

export function ProductGrid({
  products,
  emptyMessage,
}: {
  products: ProductSummary[];
  emptyMessage: string;
}) {
  if (products.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-line bg-cream-deep/50 px-6 py-14 text-center text-sm text-muted">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard product={product} priority={index < 2} />
        </li>
      ))}
    </ul>
  );
}
