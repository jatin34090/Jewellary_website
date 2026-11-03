"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ProductForm } from "@/components/admin/product-form";

export default function NewProductPage() {
  const router = useRouter();
  return (
    <div className="grid gap-6">
      <header>
        <Link
          href="/admin/products"
          className="text-xs text-brown-soft underline-offset-4 hover:underline"
        >
          ← Back to products
        </Link>
        <h1 className="mt-3 font-serif text-3xl text-brown">New product</h1>
        <p className="mt-2 text-sm text-muted">
          Save the details first. Photos and the video are added on the next screen.
        </p>
      </header>
      <ProductForm
        onSaved={(product) => {
          router.replace(`/admin/products/${product.id}`);
        }}
      />
    </div>
  );
}
