import type { Metadata } from "next";

import { OrderDetail } from "@/components/account/order-detail";

export const metadata: Metadata = { title: "Order", robots: { index: false, follow: false } };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const { orderNumber } = await params;
  const { placed } = await searchParams;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <OrderDetail orderNumber={orderNumber} justPlaced={placed === "1"} />
    </div>
  );
}
