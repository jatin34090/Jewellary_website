"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSession } from "@/lib/session/use-session";
import { signOut } from "@/lib/session/session";
import { Button } from "@/components/ui/form";
import { AddressBook } from "./address-book";
import { OrderList } from "./order-list";

export function AccountView() {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (session.status === "anonymous") router.replace("/login?next=/account");
  }, [session.status, router]);

  if (session.status !== "authenticated" || !session.user) {
    return <p className="py-20 text-center text-sm text-muted">Loading your account…</p>;
  }

  const user = session.user;

  return (
    <div className="grid gap-8">
      <section
        aria-labelledby="profile-heading"
        className="flex flex-wrap items-center justify-between gap-6 rounded-md border border-line bg-white p-6"
      >
        <div>
          <p className="text-xs tracking-[0.2em] text-gold-deep uppercase">Welcome</p>
          <h2 id="profile-heading" className="mt-2 font-serif text-2xl text-brown">
            {user.firstName}
            {user.lastName ? ` ${user.lastName}` : ""}
          </h2>
          <p className="mt-1 text-sm text-muted">{user.email}</p>
          {user.phone ? <p className="text-sm text-muted">{user.phone}</p> : null}
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            void signOut().then(() => {
              router.replace("/");
            });
          }}
        >
          Sign out
        </Button>
      </section>

      <OrderList />
      <AddressBook />
    </div>
  );
}
