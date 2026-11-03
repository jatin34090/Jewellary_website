import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getStoreSettings } from "@/lib/store/queries";

/** Layout for the customer-facing shop: announcement bar, header, content and footer. */
export default async function StoreLayout({ children }: { children: ReactNode }) {
  const settings = await getStoreSettings();
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-brown focus:px-4 focus:py-2 focus:text-cream"
      >
        Skip to content
      </a>
      <div className="bg-brown px-4 py-2 text-center text-[11px] tracking-[0.18em] text-cream/90 uppercase">
        {settings.brand.tagline}
      </div>
      <SiteHeader brand={settings.brand} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter brand={settings.brand} />
    </>
  );
}
