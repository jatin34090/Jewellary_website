"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { InventoryPanel } from "@/components/admin/inventory-panel";
import { ProductForm } from "@/components/admin/product-form";
import { ProductMedia } from "@/components/admin/product-media";
import type { AdminProduct } from "@/components/admin/types";
import { Notice } from "@/components/ui/form";
import { ApiError } from "@/lib/api/errors";
import { authorizedRequest } from "@/lib/session/session";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authorizedRequest<AdminProduct>(`/admin/products/${id}`)
      .then(setProduct)
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError && err.status === 404
            ? "This product no longer exists."
            : "Could not load this product.",
        );
      });
  }, [id]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!product) return <p className="text-sm text-muted">Loading product…</p>;

  return (
    <div className="grid gap-8">
      <header>
        <Link
          href="/admin/products"
          className="text-xs text-brown-soft underline-offset-4 hover:underline"
        >
          ← Back to products
        </Link>
        <h1 className="mt-3 font-serif text-3xl text-brown">{product.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {product.sku} ·{" "}
          {product.status === "ACTIVE"
            ? "Live on the store"
            : product.status === "DRAFT"
              ? "Draft, not visible to shoppers"
              : "Archived"}
        </p>
        <a
          href={`/products/${product.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-brown underline-offset-4 hover:underline"
        >
          View on the store
        </a>
      </header>

      <ProductForm
        product={product}
        onSaved={(next) => {
          setProduct(next);
        }}
      />
      <ProductMedia product={product} onChange={setProduct} />
      <InventoryPanel product={product} onChange={setProduct} />
    </div>
  );
}
