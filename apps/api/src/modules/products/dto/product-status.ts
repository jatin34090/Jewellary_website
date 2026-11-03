/** Mirrors the ProductStatus enum in the Prisma schema. Kept as a const tuple so class-validator can use it. */
export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type ProductStatusValue = (typeof PRODUCT_STATUSES)[number];
