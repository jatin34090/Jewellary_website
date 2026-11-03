import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";

import { AuthProvider } from "@/components/auth/auth-provider";
import { getStoreSettings, themeStyle } from "@/lib/store/queries";

import "./globals.css";

/** Brand name, tagline and favicon come from the admin store settings. */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  const { name, tagline, description, faviconUrl } = settings.brand;
  return {
    title: { default: `${name} | ${tagline}`, template: `%s | ${name}` },
    description,
    openGraph: { title: name, description: tagline, siteName: name, type: "website" },
    icons: faviconUrl ? { icon: faviconUrl } : undefined,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#38251d",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const settings = await getStoreSettings();
  const style = themeStyle(settings.theme) as CSSProperties;

  return (
    <html lang="en-IN" style={style}>
      <body className="flex min-h-screen flex-col antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
