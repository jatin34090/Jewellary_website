/**
 * Brand settings. These will move into the admin store settings in Phase 6,
 * so the storefront can change them without a code release.
 */
export const SITE = {
  name: "VRINOOR",
  tagline: "Where Elegance Meets Noor",
  description:
    "Handcrafted jewellery for every moment: earrings, rings, pendants, bracelets, anklets and combo sets.",
  email: "vrinoor.jewels@gmail.com",
  currency: "INR",
  locale: "en-IN",
  /** Social profiles shown in the footer. Empty entries are hidden. */
  socialLinks: [] as { label: string; href: string }[],
} as const;
