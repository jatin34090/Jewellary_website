import "server-only";

import { apiGet } from "../api/client";
import { withFallback } from "../catalogue/queries";
import { SITE } from "../config/site";

export type HomeSectionId =
  "hero" | "categories" | "featured" | "newArrivals" | "bestSellers" | "why";

export interface StorePublicSettings {
  brand: {
    name: string;
    tagline: string;
    description: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    email: string;
    phone: string | null;
    address: string | null;
    socialLinks: { label: string; url: string }[];
  };
  theme: { brown: string; cream: string; gold: string };
  homeSections: { id: HomeSectionId; enabled: boolean }[];
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
}

/** Defaults used when the API cannot be reached. They match the built-in brand, so the site still looks right. */
export const FALLBACK_SETTINGS: StorePublicSettings = {
  brand: {
    name: SITE.name,
    tagline: SITE.tagline,
    description: SITE.description,
    logoUrl: null,
    faviconUrl: null,
    email: SITE.email,
    phone: null,
    address: null,
    socialLinks: [],
  },
  theme: { brown: "#38251d", cream: "#f8f1e7", gold: "#b39465" },
  homeSections: [
    { id: "hero", enabled: true },
    { id: "categories", enabled: true },
    { id: "featured", enabled: true },
    { id: "newArrivals", enabled: true },
    { id: "bestSellers", enabled: true },
    { id: "why", enabled: true },
  ],
};

export function getStoreSettings(): Promise<StorePublicSettings> {
  return withFallback(
    () => apiGet<StorePublicSettings>("/store/settings", { revalidate: 60 }),
    FALLBACK_SETTINGS,
    "store settings",
  );
}

export function getHeroBanners(): Promise<Banner[]> {
  return withFallback(
    () => apiGet<Banner[]>("/banners?placement=HOME_HERO", { revalidate: 60 }),
    [],
    "hero banners",
  );
}

/** CSS variables that override the theme colours, so the brand palette can change without a rebuild. */
export function themeStyle(theme: StorePublicSettings["theme"]): Record<string, string> {
  return {
    "--color-brown": theme.brown,
    "--color-cream": theme.cream,
    "--color-gold": theme.gold,
  };
}
