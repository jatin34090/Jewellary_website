import type { OrderStatus } from "@/lib/orders/labels";

export type Availability = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface AdminInventory {
  quantityOnHand: number;
  quantityReserved: number;
  lowStockThreshold: number;
  availability: Availability;
}

export interface AdminProductImage {
  id: string;
  url: string;
  publicId: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface AdminProduct {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  price: string;
  compareAtPrice: string | null;
  weightGrams: string | null;
  material: string | null;
  isFeatured: boolean;
  salesCount: number;
  categories: { id: string; name: string; slug: string }[];
  images: AdminProductImage[];
  videoUrl: string | null;
  videoPublicId: string | null;
  inventory: AdminInventory | null;
}

export interface AdminProductPage {
  items: AdminProduct[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminOrderItem {
  productId: string;
  sku: string;
  name: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

export interface AdminOrder {
  orderNumber: string;
  status: OrderStatus;
  subtotal: string;
  discount: string;
  shipping: string;
  tax: string;
  total: string;
  couponCode: string | null;
  items: AdminOrderItem[];
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postalCode: string;
  };
  paidAt: string | null;
  createdAt: string;
  shipment: {
    status: string;
    awbCode: string | null;
    courierName: string | null;
    trackingUrl: string | null;
  } | null;
  customer?: { email: string; firstName: string };
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface AdminCoupon {
  id: string;
  code: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: string;
  maxDiscountAmount: string | null;
  minOrderAmount: string;
  usageLimit: number | null;
  usedCount: number;
  startsAt: string;
  expiresAt: string | null;
  isActive: boolean;
}

/** Same rule as the API: the first image is the primary one, and Cloudinary derives a poster frame. */
export function videoPoster(url: string): string | null {
  if (!url.includes("/video/upload/")) return null;
  return url
    .replace("/video/upload/", "/video/upload/so_0/")
    .replace(/\.(mp4|mov|webm)(\?.*)?$/i, ".jpg");
}
