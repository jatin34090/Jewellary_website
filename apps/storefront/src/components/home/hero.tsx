import Image from "next/image";
import Link from "next/link";

import type { Banner } from "@/lib/store/queries";

/** Homepage hero. A live hero banner from the admin panel replaces the default copy and picture. */
export function Hero({ tagline, banner }: { tagline: string; banner?: Banner | undefined }) {
  if (banner) {
    const href = banner.linkUrl ?? "/shop";
    return (
      <section className="relative isolate overflow-hidden bg-brown">
        <div className="relative min-h-[70svh]">
          <Image
            src={banner.mobileImageUrl ?? banner.imageUrl}
            alt={banner.title}
            fill
            priority
            sizes="100vw"
            className="object-cover md:hidden"
          />
          <Image
            src={banner.imageUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="hidden object-cover md:block"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brown/80 via-brown/30 to-transparent" />
          <div className="relative mx-auto flex min-h-[70svh] max-w-4xl flex-col items-center justify-end px-6 pb-16 pt-24 text-center text-cream">
            <h1 className="font-serif text-4xl leading-tight sm:text-6xl">{banner.title}</h1>
            {banner.subtitle ? (
              <p className="mt-4 max-w-md font-serif text-lg sm:text-xl">{banner.subtitle}</p>
            ) : null}
            <Link
              href={href}
              className="mt-8 inline-flex items-center justify-center rounded bg-cream px-8 py-4 text-sm tracking-[0.15em] text-brown uppercase transition-colors hover:bg-cream-deep"
            >
              Shop now
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-br from-sand via-cream to-cream-deep">
      <div className="mx-auto flex min-h-[70svh] max-w-4xl flex-col items-center justify-center px-6 py-20 text-center">
        <p className="mb-5 text-xs tracking-[0.3em] text-gold-deep uppercase">
          A touch of elegance
        </p>
        <h1 className="font-serif text-5xl leading-tight text-brown sm:text-6xl lg:text-7xl">
          Discover Your <span className="italic text-gold-deep">Noor</span>
        </h1>
        <p className="mt-6 max-w-md font-serif text-lg text-brown-soft sm:text-xl">{tagline}</p>
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
