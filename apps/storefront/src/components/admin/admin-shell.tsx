"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { Button } from "@/components/ui/form";
import { signOut, type UserRole } from "@/lib/session/session";
import { useSession } from "@/lib/session/use-session";

const NAV: { href: string; label: string; roles: UserRole[] }[] = [
  { href: "/admin", label: "Dashboard", roles: ["ADMIN", "STAFF"] },
  { href: "/admin/products", label: "Products", roles: ["ADMIN", "STAFF"] },
  { href: "/admin/categories", label: "Categories", roles: ["ADMIN", "STAFF"] },
  { href: "/admin/inventory", label: "Inventory", roles: ["ADMIN", "STAFF"] },
  { href: "/admin/orders", label: "Orders", roles: ["ADMIN", "STAFF"] },
  { href: "/admin/coupons", label: "Coupons", roles: ["ADMIN"] },
];

/**
 * Admin frame: sign-in form when signed out, an access message for customers, and the
 * navigation and page content for staff and admins. The API enforces the same roles on every call.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (session.status === "authenticated" && session.user?.role === "CUSTOMER") {
      // Customers have no business in the admin panel, so send them to their account.
      router.replace("/account");
    }
  }, [session.status, session.user?.role, router]);

  if (session.status === "loading") {
    return <p className="py-24 text-center text-sm text-muted">Loading…</p>;
  }

  if (session.status === "anonymous") {
    return (
      <div className="min-h-screen bg-cream">
        <AdminHeader />
        <LoginForm next="/admin" title="Admin sign in" adminHint />
      </div>
    );
  }

  const role = session.user?.role;
  if (!role || role === "CUSTOMER") {
    return (
      <div className="min-h-screen bg-cream">
        <AdminHeader />
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <p className="font-serif text-2xl text-brown">Redirecting to your account…</p>
        </div>
      </div>
    );
  }

  const links = NAV.filter((item) => item.roles.includes(role));

  return (
    <div className="min-h-screen bg-cream md:grid md:grid-cols-[240px_1fr]">
      <aside className="bg-brown text-cream md:min-h-screen">
        <div className="flex items-center justify-between px-5 py-5 md:block">
          <Link href="/admin" className="font-serif text-xl tracking-[0.25em] text-gold">
            VRINOOR
          </Link>
          <p className="text-[11px] tracking-[0.2em] text-cream/60 uppercase md:mt-1">
            Admin panel
          </p>
        </div>
        <nav
          aria-label="Admin"
          className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1 md:px-3 md:pb-0"
        >
          {links.map((item) => {
            const active =
              item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-cream/15 text-cream"
                    : "text-cream/75 hover:bg-cream/10 hover:text-cream"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0">
        <header className="flex items-center justify-between gap-4 border-b border-line bg-white px-5 py-4">
          <p className="text-sm text-brown-soft">
            Signed in as <span className="font-medium text-brown">{session.user?.firstName}</span>{" "}
            <span className="text-xs text-muted">({role === "ADMIN" ? "Admin" : "Staff"})</span>
          </p>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-brown-soft underline-offset-4 hover:underline">
              View store
            </Link>
            <Button
              variant="secondary"
              onClick={() => {
                void signOut().then(() => {
                  router.replace("/admin");
                });
              }}
            >
              Sign out
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

function AdminHeader() {
  return (
    <header className="bg-brown px-5 py-5 text-center">
      <p className="font-serif text-2xl tracking-[0.25em] text-gold">VRINOOR</p>
      <p className="mt-1 text-[11px] tracking-[0.2em] text-cream/70 uppercase">Admin panel</p>
    </header>
  );
}
