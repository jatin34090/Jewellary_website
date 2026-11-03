/** Shapes returned by the NestJS API. Keep in step with apps/api (see the catalogue module). */

export type Availability = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface ProductImage {
  url: string;
  altText: string | null;
  isPrimary: boolean;
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  material: string | null;
  /** Decimal string, for example "12999.00". Parse with toPaise(), never with parseFloat(). */
  price: string;
  compareAtPrice: string | null;
  discountPercent: number | null;
  isFeatured: boolean;
  primaryImage: { url: string; altText: string | null } | null;
  availability: Availability;
}

export interface ProductDetail extends ProductSummary {
  sku: string;
  description: string;
  weightGrams: string | null;
  video: { url: string; posterUrl: string | null } | null;
  images: ProductImage[];
  categories: { id: string; name: string; slug: string }[];
  related: ProductSummary[];
}

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  children: CategoryNode[];
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export type CatalogueSort = "newest" | "price_asc" | "price_desc" | "best_selling";
