import { UserRole } from "@jewellery/database";

/** Roles that may manage the catalogue (categories, products, images, inventory). */
export const CATALOGUE_ROLES = [UserRole.ADMIN, UserRole.STAFF] as const;

/** Roles that may change store-wide configuration and staff accounts. */
export const ADMIN_ONLY = [UserRole.ADMIN] as const;
