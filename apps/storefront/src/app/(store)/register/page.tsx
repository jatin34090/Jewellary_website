import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/register-form";
import { safeNextPath } from "@/lib/navigation/safe-next";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  return <RegisterForm next={safeNextPath(params.next)} />;
}
