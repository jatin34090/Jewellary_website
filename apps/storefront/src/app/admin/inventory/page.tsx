"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Notice } from "@/components/ui/form";
import type { AdminProduct, AdminProductPage } from "@/components/admin/types";
import { ApiError } from "@/lib/api/errors";
import { authorizedRequest } from "@/lib/session/session";

/** Every live product's stock at a glance. Edit a product to change its stock with a reason. */
export default function InventoryPage() {
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authorizedRequest<AdminProductPage>("/admin/products?status=ACTIVE&pageSize=100")
      .then((page) => {
        setProducts(page.items);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Could not load stock levels.");
      });
  }, []);

  const rows = (products ?? []).filter((product) => {
    if (filter === "low") return product.inventory?.availability === "LOW_STOCK";
    if (filter === "out") return product.inventory?.availability === "OUT_OF_STOCK";
    return true;
  });

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-gold-deep uppercase">Stock</p>
          <h1 className="mt-2 font-serif text-3xl text-brown">Inventory</h1>
        </div>
        <div className="flex gap-2 text-sm">
          {(["all", "low", "out"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setFilter(key);
              }}
              className={`rounded px-4 py-2 transition-colors ${filter === key ? "bg-brown text-cream" : "border border-brown/25 text-brown hover:border-brown"}`}
            >
              {key === "all" ? "All" : key === "low" ? "Low stock" : "Out of stock"}
            </button>
          ))}
        </div>
      </header>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {!products && !error ? <p className="text-sm text-muted">Loading stock levels…</p> : null}

      {products ? (
        <div className="overflow-x-auto rounded-md border border-line bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line bg-cream-deep/50 text-xs tracking-wide text-brown-soft uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">On hand</th>
                <th className="px-4 py-3 font-medium">Reserved</th>
                <th className="px-4 py-3 font-medium">Sellable</th>
                <th className="px-4 py-3 font-medium">Alert at</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    Nothing to show for this filter.
                  </td>
                </tr>
              ) : (
                rows.map((product) => {
                  const inv = product.inventory;
                  return (
                    <tr key={product.id}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="font-medium text-brown hover:text-gold-deep"
                        >
                          {product.name}
                        </Link>
                        <p className="text-xs text-muted">{product.sku}</p>
                      </td>
                      <td className="px-4 py-3 text-brown">{inv?.quantityOnHand ?? "—"}</td>
                      <td className="px-4 py-3 text-brown-soft">{inv?.quantityReserved ?? "—"}</td>
                      <td className="px-4 py-3 text-brown">
                        {inv ? inv.quantityOnHand - inv.quantityReserved : "—"}
                      </td>
                      <td className="px-4 py-3 text-brown-soft">{inv?.lowStockThreshold ?? "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        {inv?.availability === "OUT_OF_STOCK"
                          ? "Out of stock"
                          : inv?.availability === "LOW_STOCK"
                            ? "Low"
                            : "In stock"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
