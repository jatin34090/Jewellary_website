import Image from "next/image";
import Link from "next/link";

import type { StorePublicSettings } from "@/lib/store/queries";
import { HeaderCounts } from "./header-counts";

const NAV_LINKS = [
  { label: "Shop All", href: "/shop" },
  { label: "Rings", href: "/shop?category=rings" },
  { label: "Earrings", href: "/shop?category=earrings" },
  { label: "Pendants", href: "/shop?category=pendants" },
  { label: "Bracelets", href: "/shop?category=bracelets" },
  { label: "Anklets", href: "/shop?category=anklets" },
  { label: "Combo Sets", href: "/shop?category=combo-sets" },
];

export function SiteHeader({ brand }: { brand: StorePublicSettings["brand"] }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-3 font-serif text-2xl tracking-[0.25em] text-brown sm:text-3xl"
          aria-label={`${brand.name} home`}
        >
          {brand.logoUrl ? (
            <span className="relative block h-9 w-28 sm:h-10 sm:w-36">
              <Image
                src={brand.logoUrl}
                alt={brand.name}
                fill
                sizes="144px"
                className="object-contain"
              />
            </span>
          ) : (
            brand.name
          )}
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <HeaderCounts />
        </div>
      </div>

      <nav aria-label="Categories" className="border-t border-line">
        <ul className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4 py-3 text-[13px] whitespace-nowrap sm:px-6">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-brown-soft transition-colors hover:text-gold-deep"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
