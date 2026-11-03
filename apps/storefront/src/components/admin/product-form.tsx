"use client";

import { useEffect, useState, type SyntheticEvent } from "react";

import { Button, Field, Notice, SelectInput, TextArea, TextInput } from "@/components/ui/form";
import { ApiError } from "@/lib/api/errors";
import { browserGet } from "@/lib/api/browser-client";
import type { CategoryNode } from "@/lib/api/types";
import { authorizedRequest } from "@/lib/session/session";
import type { AdminProduct } from "./types";

const MONEY = /^\d{1,8}(\.\d{1,2})?$/;
const SKU = /^[A-Z0-9][A-Z0-9-]{1,62}[A-Z0-9]$/;

interface ProductFormProps {
  product?: AdminProduct;
  onSaved: (product: AdminProduct) => void;
}

interface FormValues {
  sku: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  compareAtPrice: string;
  material: string;
  weightGrams: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  isFeatured: boolean;
  categoryIds: string[];
  initialStock: string;
  lowStockThreshold: string;
}

function toValues(product?: AdminProduct): FormValues {
  return {
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    description: product?.description ?? "",
    price: product?.price ?? "",
    compareAtPrice: product?.compareAtPrice ?? "",
    material: product?.material ?? "",
    weightGrams: product?.weightGrams ?? "",
    status: product?.status ?? "DRAFT",
    isFeatured: product?.isFeatured ?? false,
    categoryIds: product?.categories.map((c) => c.id) ?? [],
    initialStock: "0",
    lowStockThreshold: "5",
  };
}

function flatten(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

/** Create or edit a product's details. Images, video and stock are managed on the product page. */
export function ProductForm({ product, onSaved }: ProductFormProps) {
  const [values, setValues] = useState<FormValues>(() => toValues(product));
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const isNew = !product;

  useEffect(() => {
    browserGet<CategoryNode[]>("/categories")
      .then(setCategories)
      .catch(() => {
        setCategories([]);
      });
  }, []);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const toggleCategory = (id: string) => {
    set(
      "categoryIds",
      values.categoryIds.includes(id)
        ? values.categoryIds.filter((c) => c !== id)
        : [...values.categoryIds, id],
    );
  };

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    if (isNew && !SKU.test(values.sku.trim().toUpperCase()))
      next["sku"] = "Use 3 to 64 letters, digits or hyphens";
    if (values.name.trim().length < 1) next["name"] = "Enter the product name";
    if (values.description.trim().length < 1) next["description"] = "Add a description";
    if (!MONEY.test(values.price.trim())) next["price"] = "Enter a price such as 12999 or 12999.50";
    if (values.compareAtPrice.trim() && !MONEY.test(values.compareAtPrice.trim()))
      next["compareAtPrice"] = "Enter a valid amount";
    if (
      values.compareAtPrice.trim() &&
      MONEY.test(values.price.trim()) &&
      Number(values.compareAtPrice) < Number(values.price)
    ) {
      next["compareAtPrice"] = "The original price must be at least the selling price";
    }
    if (values.weightGrams.trim() && !/^\d{1,4}(\.\d{1,2})?$/.test(values.weightGrams.trim()))
      next["weightGrams"] = "Enter the weight in grams";
    if (isNew && !/^\d+$/.test(values.initialStock)) next["initialStock"] = "Enter a whole number";
    return next;
  };

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setSaved(false);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    setFormError(null);
    const common = {
      name: values.name.trim(),
      slug: values.slug.trim() || undefined,
      description: values.description.trim(),
      price: values.price.trim(),
      compareAtPrice: values.compareAtPrice.trim() || undefined,
      material: values.material.trim() || undefined,
      weightGrams: values.weightGrams.trim() || undefined,
      status: values.status,
      isFeatured: values.isFeatured,
      categoryIds: values.categoryIds,
    };

    try {
      const result = isNew
        ? await authorizedRequest<AdminProduct>("/admin/products", {
            method: "POST",
            body: {
              ...common,
              sku: values.sku.trim().toUpperCase(),
              initialStock: Number(values.initialStock),
              lowStockThreshold: Number(values.lowStockThreshold),
            },
          })
        : await authorizedRequest<AdminProduct>(`/admin/products/${product.id}`, {
            method: "PATCH",
            body: common,
          });
      setSaved(true);
      onSaved(result);
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "The product could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-6">
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      {saved ? <Notice tone="success">Product saved.</Notice> : null}

      <section className="grid gap-5 rounded-md border border-line bg-white p-6 sm:grid-cols-2">
        <h2 className="font-serif text-xl text-brown sm:col-span-2">Details</h2>
        <Field
          label="Product name"
          htmlFor="pf-name"
          error={errors["name"]}
          className="sm:col-span-2"
        >
          <TextInput
            id="pf-name"
            value={values.name}
            onChange={(e) => {
              set("name", e.target.value);
            }}
            maxLength={255}
          />
        </Field>
        <Field
          label="SKU"
          htmlFor="pf-sku"
          error={errors["sku"]}
          hint={
            isNew ? "Unique code, for example RG-ROSE-001" : "SKU cannot be changed after creation"
          }
        >
          <TextInput
            id="pf-sku"
            value={values.sku}
            onChange={(e) => {
              set("sku", e.target.value.toUpperCase());
            }}
            disabled={!isNew}
            maxLength={64}
          />
        </Field>
        <Field
          label="URL slug (optional)"
          htmlFor="pf-slug"
          hint="Generated from the name when empty"
        >
          <TextInput
            id="pf-slug"
            value={values.slug}
            onChange={(e) => {
              set("slug", e.target.value.toLowerCase());
            }}
            maxLength={255}
          />
        </Field>
        <Field
          label="Description"
          htmlFor="pf-desc"
          error={errors["description"]}
          className="sm:col-span-2"
        >
          <TextArea
            id="pf-desc"
            value={values.description}
            onChange={(e) => {
              set("description", e.target.value);
            }}
            maxLength={10000}
            rows={6}
          />
        </Field>
        <Field label="Material" htmlFor="pf-material">
          <TextInput
            id="pf-material"
            value={values.material}
            onChange={(e) => {
              set("material", e.target.value);
            }}
            maxLength={100}
            placeholder="18K rose gold"
          />
        </Field>
        <Field label="Weight (grams)" htmlFor="pf-weight" error={errors["weightGrams"]}>
          <TextInput
            id="pf-weight"
            value={values.weightGrams}
            onChange={(e) => {
              set("weightGrams", e.target.value);
            }}
            inputMode="decimal"
          />
        </Field>
      </section>

      <section className="grid gap-5 rounded-md border border-line bg-white p-6 sm:grid-cols-3">
        <h2 className="font-serif text-xl text-brown sm:col-span-3">Price and status</h2>
        <Field label="Price (₹)" htmlFor="pf-price" error={errors["price"]}>
          <TextInput
            id="pf-price"
            value={values.price}
            onChange={(e) => {
              set("price", e.target.value);
            }}
            inputMode="decimal"
          />
        </Field>
        <Field
          label="Original price (₹)"
          htmlFor="pf-compare"
          error={errors["compareAtPrice"]}
          hint="Shown struck through when higher"
        >
          <TextInput
            id="pf-compare"
            value={values.compareAtPrice}
            onChange={(e) => {
              set("compareAtPrice", e.target.value);
            }}
            inputMode="decimal"
          />
        </Field>
        <Field label="Status" htmlFor="pf-status">
          <SelectInput
            id="pf-status"
            value={values.status}
            onChange={(e) => {
              set("status", e.target.value as FormValues["status"]);
            }}
          >
            <option value="DRAFT">Draft (hidden from shoppers)</option>
            <option value="ACTIVE">Live</option>
            <option value="ARCHIVED">Archived</option>
          </SelectInput>
        </Field>
        <label className="flex items-center gap-2 text-sm text-brown sm:col-span-3">
          <input
            type="checkbox"
            checked={values.isFeatured}
            onChange={(e) => {
              set("isFeatured", e.target.checked);
            }}
            className="size-4 accent-brown"
          />
          Feature on the homepage
        </label>
        {isNew ? (
          <>
            <Field label="Starting stock" htmlFor="pf-stock" error={errors["initialStock"]}>
              <TextInput
                id="pf-stock"
                value={values.initialStock}
                onChange={(e) => {
                  set("initialStock", e.target.value);
                }}
                inputMode="numeric"
              />
            </Field>
            <Field
              label="Low-stock alert at"
              htmlFor="pf-threshold"
              hint="Units left that trigger a low-stock warning"
            >
              <TextInput
                id="pf-threshold"
                value={values.lowStockThreshold}
                onChange={(e) => {
                  set("lowStockThreshold", e.target.value);
                }}
                inputMode="numeric"
              />
            </Field>
          </>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-md border border-line bg-white p-6">
        <h2 className="font-serif text-xl text-brown">Categories</h2>
        {categories.length === 0 ? (
          <p className="text-sm text-muted">No categories yet. Add them under Categories first.</p>
        ) : (
          <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-3">
            {flatten(categories).map((category) => (
              <li key={category.id}>
                <label className="flex items-center gap-2 text-sm text-brown">
                  <input
                    type="checkbox"
                    checked={values.categoryIds.includes(category.id)}
                    onChange={() => {
                      toggleCategory(category.id);
                    }}
                    className="size-4 accent-brown"
                  />
                  {category.name}
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : isNew ? "Create product" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
