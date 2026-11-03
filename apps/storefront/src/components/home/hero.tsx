import Link from "next/link";

import { SITE } from "@/lib/config/site";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-br from-sand via-cream to-cream-deep">
      <div className="mx-auto flex min-h-[70svh] max-w-4xl flex-col items-center justify-center px-6 py-20 text-center">
        <p className="mb-5 text-xs tracking-[0.3em] text-gold-deep uppercase">
          A touch of elegance
        </p>
        <h1 className="font-serif text-5xl leading-tight text-brown sm:text-6xl lg:text-7xl">
          Discover Your <span className="italic text-gold-deep">Noor</span>
        </h1>
        <p className="mt-6 max-w-md font-serif text-lg text-brown-soft sm:text-xl">
          {SITE.tagline}
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center rounded bg-brown px-8 py-4 text-sm tracking-[0.15em] text-cream uppercase transition-colors hover:bg-brown-soft"
          >
            Shop now
          </Link>
          <Link
            href="/shop?sort=best_selling"
            className="inline-flex items-center justify-center rounded border border-brown/30 px-8 py-4 text-sm tracking-[0.15em] text-brown uppercase transition-colors hover:border-brown"
          >
            Best sellers
          </Link>
        </div>
      </div>
    </section>
  );
}
