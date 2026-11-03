import Link from "next/link";

import type { StorePublicSettings } from "@/lib/store/queries";

const SHOP_LINKS = [
  { label: "Shop All", href: "/shop" },
  { label: "Rings", href: "/shop?category=rings" },
  { label: "Earrings", href: "/shop?category=earrings" },
  { label: "Pendants", href: "/shop?category=pendants" },
];

export function SiteFooter({ brand }: { brand: StorePublicSettings["brand"] }) {
  return (
    <footer className="mt-20 bg-brown text-cream">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <p className="font-serif text-2xl tracking-[0.25em] text-gold">{brand.name}</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-cream/80">{brand.description}</p>
          <p className="mt-4 font-serif text-base italic text-cream/90">{brand.tagline}</p>
        </div>

        <nav aria-label="Footer">
          <h2 className="text-sm tracking-[0.2em] text-gold uppercase">Shop</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {SHOP_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-cream/85 hover:text-gold">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-sm tracking-[0.2em] text-gold uppercase">Enquiries</h2>
          <p className="mt-4 text-sm text-cream/85">For orders and enquiries</p>
          <a
            href={`mailto:${brand.email}`}
            className="mt-1 block text-sm text-cream underline-offset-4 hover:underline"
          >
            {brand.email}
          </a>
          {brand.phone ? <p className="mt-1 text-sm text-cream/85">{brand.phone}</p> : null}
          {brand.address ? <p className="mt-1 text-sm text-cream/85">{brand.address}</p> : null}
          {brand.socialLinks.length > 0 ? (
            <ul className="mt-5 flex flex-wrap gap-4 text-sm">
              {brand.socialLinks.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    className="text-cream/85 hover:text-gold"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <div className="border-t border-cream/15 px-4 py-5 text-center text-xs text-cream/60">
        © {new Date().getFullYear()} {brand.name}. All rights reserved.
      </div>
    </footer>
  );
}
