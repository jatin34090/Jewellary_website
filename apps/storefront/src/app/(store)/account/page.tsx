import type { Metadata } from "next";

import { AccountView } from "@/components/account/account-view";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="mb-10 font-serif text-4xl text-brown">My account</h1>
      <AccountView />
    </div>
  );
}
