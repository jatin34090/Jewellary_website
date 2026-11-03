import type { Prisma } from "@jewellery/database";

import { stockStatus, type StockStatus } from "../inventory/stock-status";

/**
 * Prisma include definitions and response mappers. Keeping them together means every product
 * query loads exactly the fields its response needs, and the public shapes stay in one place.
 */

const inventorySelect = {
  quantityOnHand: true,
  quantityReserved: true,
  lowStockThreshold: true,
} as const;

/** Card view: one image, and stock levels to derive availability. */
export const summaryInclude = {
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
  inventory: { select: inventorySelect },
} satisfies Prisma.ProductInclude;

/** Detail view: all images and categories, plus stock levels for availability. */
export const detailInclude = {
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
  inventory: { select: inventorySelect },
  categories: {
    select: {
      category: { select: { id: true, name: true, slug: true, isActive: true, deletedAt: true } },
    },
  },
} satisfies Prisma.ProductInclude;

/** Admin view: full stock numbers and every category assignment. */
export const adminInclude = {
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
  inventory: true,
  categories: {
    select: { category: { select: { id: true, name: true, slug: true } } },
  },
} satisfies Prisma.ProductInclude;

export type SummaryRow = Prisma.ProductGetPayload<{ include: typeof summaryInclude }>;
export type DetailRow = Prisma.ProductGetPayload<{ include: typeof detailInclude }>;
export type AdminRow = Prisma.ProductGetPayload<{ include: typeof adminInclude }>;

export interface PublicProductSummary {
  id: string;
  slug: string;
  name: string;
  material: string | null;
  price: string;
  compareAtPrice: string | null;
  discountPercent: number | null;
  isFeatured: boolean;
  primaryImage: { url: string; altText: string | null } | null;
  availability: StockStatus;
}

export interface PublicProductDetail extends PublicProductSummary {
  sku: string;
  description: string;
  weightGrams: string | null;
  images: { url: string; altText: string | null; isPrimary: boolean }[];
  categories: { id: string; name: string; slug: string }[];
  related: PublicProductSummary[];
}

export interface AdminProductView {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  status: string;
  price: string;
  compareAtPrice: string | null;
  weightGrams: string | null;
  material: string | null;
  isFeatured: boolean;
  salesCount: number;
  categories: { id: string; name: string; slug: string }[];
  images: {
    id: string;
    url: string;
    publicId: string;
    altText: string | null;
    sortOrder: number;
    isPrimary: boolean;
  }[];
  inventory: {
    quantityOnHand: number;
    quantityReserved: number;
    lowStockThreshold: number;
    availability: StockStatus;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

type Levels = {
  quantityOnHand: number;
  quantityReserved: number;
  lowStockThreshold: number;
} | null;

/** No inventory record means nothing can be sold, so the product reads as out of stock. */
export function availabilityOf(levels: Levels): StockStatus {
  return levels ? stockStatus(levels) : "OUT_OF_STOCK";
}

export function discountPercentOf(
  price: Prisma.Decimal,
  compareAtPrice: Prisma.Decimal | null,
): number | null {
  if (!compareAtPrice || compareAtPrice.lte(price)) return null;
  return compareAtPrice.minus(price).div(compareAtPrice).times(100).round().toNumber();
}

export function toPublicSummary(row: SummaryRow): PublicProductSummary {
  const primary = row.images[0];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    material: row.material,
    price: row.price.toFixed(2),
    compareAtPrice: row.compareAtPrice ? row.compareAtPrice.toFixed(2) : null,
    discountPercent: discountPercentOf(row.price, row.compareAtPrice),
    isFeatured: row.isFeatured,
    primaryImage: primary ? { url: primary.url, altText: primary.altText } : null,
    availability: availabilityOf(row.inventory),
  };
}

export function toPublicDetail(
  row: DetailRow,
  related: PublicProductSummary[],
): PublicProductDetail {
  return {
    ...toPublicSummary({ ...row, images: row.images.slice(0, 1) }),
    sku: row.sku,
    description: row.description,
    weightGrams: row.weightGrams ? row.weightGrams.toFixed(2) : null,
    images: row.images.map((image) => ({
      url: image.url,
      altText: image.altText,
      isPrimary: image.isPrimary,
    })),
    categories: row.categories
      .map((link) => link.category)
      .filter((category) => category.isActive && category.deletedAt === null)
      .map((category) => ({ id: category.id, name: category.name, slug: category.slug })),
    related,
  };
}

export function toAdminView(row: AdminRow): AdminProductView {
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    description: row.description,
    status: row.status,
    price: row.price.toFixed(2),
    compareAtPrice: row.compareAtPrice ? row.compareAtPrice.toFixed(2) : null,
    weightGrams: row.weightGrams ? row.weightGrams.toFixed(2) : null,
    material: row.material,
    isFeatured: row.isFeatured,
    salesCount: row.salesCount,
    categories: row.categories.map((link) => link.category),
    images: row.images,
    inventory: row.inventory
      ? {
          quantityOnHand: row.inventory.quantityOnHand,
          quantityReserved: row.inventory.quantityReserved,
          lowStockThreshold: row.inventory.lowStockThreshold,
          availability: availabilityOf(row.inventory),
        }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}
