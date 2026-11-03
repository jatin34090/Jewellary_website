"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AddressForm, type AddressRecord } from "@/components/account/address-form";
import { Button, Field, Notice, TextInput } from "@/components/ui/form";
import { bagStore, countItems, removeLine, type BagLine } from "@/lib/bag/bag";
import { browserPost } from "@/lib/api/browser-client";
import { ApiError } from "@/lib/api/errors";
import { formatPrice } from "@/lib/money";
import { openRazorpay } from "@/lib/payments/razorpay";
import { authorizedRequest, type SessionUser } from "@/lib/session/session";
import { useSession } from "@/lib/session/use-session";
import { useLocalStore } from "@/lib/storage/use-local-store";

interface QuoteLine {
  productId: string;
  name: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  availability: string;
}

interface Quote {
  lines: QuoteLine[];
  issues: { productId: string; code: string; message: string }[];
  subtotal: string;
  discount: string;
  couponCode: string | null;
  couponError: string | null;
  shipping: string;
  tax: string;
  total: string;
  canCheckout: boolean;
}

interface CheckoutOrderData {
  order: { orderNumber: string; total: string };
  payment: { keyId: string; razorpayOrderId: string; amount: number; currency: "INR" };
}

interface OrderConfirmation {
  orderNumber: string;
}

/**
 * Checkout: confirm the bag, pick a delivery address, apply a coupon, then pay with Razorpay.
 * Every amount shown is recalculated by the server. The browser's numbers are only for display.
 */
export function CheckoutView() {
  const router = useRouter();
  const session = useSession();
  const bag = useLocalStore(bagStore);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<AddressRecord[] | null>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const idempotency = useRef<{ fingerprint: string; key: string } | null>(null);

  // Anonymous visitors are sent to sign in, then returned here.
  useEffect(() => {
    if (session.status === "anonymous") router.replace("/login?next=/checkout");
  }, [session.status, router]);

  // Addresses load once the visitor is signed in.
  useEffect(() => {
    if (session.status !== "authenticated") return;
    authorizedRequest<AddressRecord[]>("/addresses")
      .then((list) => {
        setAddresses(list);
        setAddressId(
          (current) => current ?? list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? null,
        );
      })
      .catch((err: unknown) => {
        setNotice({
          tone: "error",
          text: err instanceof ApiError ? err.message : "Could not load your addresses.",
        });
      });
  }, [session.status]);

  const itemsKey = useMemo(
    () => bag.map((line) => `${line.productId}:${line.quantity}`).join("|"),
    [bag],
  );

  // Re-price whenever the bag or the coupon changes. The server returns the authoritative totals.
  useEffect(() => {
    if (bag.length === 0) {
      setQuote(null);
      return;
    }
    let active = true;
    browserPost<Quote>("/checkout/quote", {
      items: bag.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      couponCode,
    })
      .then((result) => {
        if (active) {
          setQuote(result);
          setQuoteError(null);
        }
      })
      .catch((err: unknown) => {
        if (active)
          setQuoteError(err instanceof ApiError ? err.message : "We could not price your bag.");
      });
    return () => {
      active = false;
    };
  }, [bag, couponCode]);

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    setCouponCode(code || undefined);
  };

  const pay = async () => {
    if (!addressId || !quote?.canCheckout) return;
    setBusy(true);
    setNotice(null);

    // The same checkout attempt reuses its idempotency key, so a retry cannot create a second order.
    const fingerprint = `${itemsKey}|${couponCode ?? ""}|${addressId}`;
    if (idempotency.current?.fingerprint !== fingerprint) {
      idempotency.current = { fingerprint, key: `checkout-${crypto.randomUUID()}` };
    }

    try {
      const created = await authorizedRequest<CheckoutOrderData>("/checkout/orders", {
        method: "POST",
        headers: { "Idempotency-Key": idempotency.current.key },
        body: {
          items: bag.map((line) => ({ productId: line.productId, quantity: line.quantity })),
          addressId,
          couponCode,
        },
      });

      const user: SessionUser | null = session.user;
      await openRazorpay({
        key: created.payment.keyId,
        amount: created.payment.amount,
        currency: "INR",
        name: "VRINOOR",
        description: `Order ${created.order.orderNumber}`,
        order_id: created.payment.razorpayOrderId,
        prefill: {
          name: user ? `${user.firstName} ${user.lastName ?? ""}`.trim() : undefined,
          email: user?.email,
        },
        theme: { color: "#38251d" },
        handler: (response) => {
          void authorizedRequest<OrderConfirmation>("/checkout/payments/verify", {
            method: "POST",
            body: response,
          })
            .then((confirmed) => {
              bagStore.update(() => []);
              idempotency.current = null;
              router.push(`/orders/${confirmed.orderNumber}?placed=1`);
            })
            .catch((err: unknown) => {
              setBusy(false);
              setNotice({
                tone: "error",
                text:
                  err instanceof ApiError
                    ? err.message
                    : "We could not confirm your payment. Please contact us with your order number.",
              });
            });
        },
        modal: {
          ondismiss: () => {
            setBusy(false);
            setNotice({
              tone: "info",
              text: "Payment was not completed. Your items are held for a short time. You can try again from checkout.",
            });
          },
        },
        onFailure: (message) => {
          setBusy(false);
          setNotice({ tone: "error", text: message });
        },
      });
    } catch (err) {
      setBusy(false);
      setNotice({
        tone: "error",
        text: err instanceof ApiError ? err.message : "Checkout could not start. Please try again.",
      });
    }
  };

  if (session.status !== "authenticated") {
    return <p className="py-20 text-center text-sm text-muted">Preparing checkout…</p>;
  }

  if (bag.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="font-serif text-2xl text-brown">Your bag is empty.</p>
        <Link
          href="/shop"
          className="mt-6 inline-block text-sm text-brown underline underline-offset-4"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  const canPay = Boolean(addressId && quote?.canCheckout && !busy);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div className="grid gap-8">
        {notice ? (
          <Notice tone={notice.tone === "error" ? "error" : "info"}>{notice.text}</Notice>
        ) : null}

        <section
          aria-labelledby="address-heading"
          className="rounded-md border border-line bg-white p-6"
        >
          <div className="mb-5 flex items-center justify-between">
            <h2 id="address-heading" className="font-serif text-2xl text-brown">
              Delivery address
            </h2>
            {!addingAddress ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setAddingAddress(true);
                }}
              >
                Add new
              </Button>
            ) : null}
          </div>

          {addingAddress ? (
            <AddressForm
              onCancel={() => {
                setAddingAddress(false);
              }}
              onSaved={(saved) => {
                setAddresses((current) => [...(current ?? []), saved]);
                setAddressId(saved.id);
                setAddingAddress(false);
              }}
            />
          ) : addresses === null ? (
            <p className="text-sm text-muted">Loading addresses…</p>
          ) : addresses.length === 0 ? (
            <p className="text-sm text-muted">Add a delivery address to continue.</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {addresses.map((address) => (
                <li key={address.id}>
                  <label
                    className={`block cursor-pointer rounded-md border p-4 text-sm transition-colors ${
                      addressId === address.id
                        ? "border-brown bg-cream-deep/40"
                        : "border-line hover:border-brown/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      className="mr-2 accent-brown"
                      checked={addressId === address.id}
                      onChange={() => {
                        setAddressId(address.id);
                      }}
                    />
                    <span className="font-medium text-brown">{address.fullName}</span>
                    <span className="mt-2 block leading-relaxed text-brown-soft">
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.state}{" "}
                      {address.postalCode}
                      <br />
                      {address.phone}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="bag-heading"
          className="rounded-md border border-line bg-white p-6"
        >
          <h2 id="bag-heading" className="mb-5 font-serif text-2xl text-brown">
            Your bag ({countItems(bag)})
          </h2>
          <ul className="divide-y divide-line">
            {bag.map((line) => (
              <BagSummaryRow
                key={line.slug}
                line={line}
                quoteLine={quote?.lines.find((l) => l.productId === line.productId)}
                unavailable={
                  quote?.issues.some(
                    (i) => i.productId === line.productId && i.code === "UNAVAILABLE",
                  ) ?? false
                }
              />
            ))}
          </ul>
          {quote?.issues.length ? (
            <div className="mt-5">
              <Notice tone="error">
                Some pieces need your attention:{" "}
                {quote.issues.map((issue) => issue.message).join(" ")} Please update your bag.
              </Notice>
            </div>
          ) : null}
        </section>
      </div>

      <aside className="h-fit rounded-md border border-line bg-cream-deep/60 p-6 lg:sticky lg:top-40">
        <h2 className="font-serif text-2xl text-brown">Order summary</h2>

        <div className="mt-5 flex items-end gap-2">
          <Field label="Coupon" htmlFor="coupon" className="flex-1">
            <TextInput
              id="coupon"
              value={couponInput}
              onChange={(e) => {
                setCouponInput(e.target.value);
              }}
              placeholder="Enter code"
              maxLength={40}
            />
          </Field>
          <Button variant="secondary" onClick={applyCoupon} className="mb-px">
            Apply
          </Button>
        </div>
        {quote?.couponError ? (
          <p className="mt-2 text-xs text-gold-deep">{quote.couponError}</p>
        ) : null}
        {quote?.couponCode && !quote.couponError ? (
          <p className="mt-2 text-xs text-brown-soft">Coupon {quote.couponCode} applied.</p>
        ) : null}
        {quoteError ? <p className="mt-2 text-xs text-gold-deep">{quoteError}</p> : null}

        <dl className="mt-6 space-y-3 text-sm">
          <Row label="Subtotal" value={quote ? formatPrice(quote.subtotal) : "…"} />
          {quote && Number(quote.discount) > 0 ? (
            <Row label="Discount" value={`− ${formatPrice(quote.discount)}`} />
          ) : null}
          <Row
            label="Delivery"
            value={
              quote ? (Number(quote.shipping) === 0 ? "Free" : formatPrice(quote.shipping)) : "…"
            }
          />
          {quote && Number(quote.tax) > 0 ? (
            <Row label="Tax" value={formatPrice(quote.tax)} />
          ) : null}
          <div className="flex justify-between border-t border-line pt-4 text-base font-medium text-brown">
            <dt>Total</dt>
            <dd>{quote ? formatPrice(quote.total) : "…"}</dd>
          </div>
        </dl>

        <Button onClick={() => void pay()} disabled={!canPay} className="mt-6 w-full py-3.5">
          {busy ? "Opening payment…" : `Pay ${quote ? formatPrice(quote.total) : ""}`}
        </Button>
        <p className="mt-3 text-center text-xs text-muted">
          Secure payment by Razorpay. Prices are confirmed on the server.
        </p>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="text-brown">{value}</dd>
    </div>
  );
}

function BagSummaryRow({
  line,
  quoteLine,
  unavailable,
}: {
  line: BagLine;
  quoteLine: QuoteLine | undefined;
  unavailable: boolean;
}) {
  return (
    <li className="flex gap-4 py-4">
      <div className="relative size-16 shrink-0 overflow-hidden rounded bg-sand">
        {line.image ? (
          <Image src={line.image} alt={line.name} fill sizes="64px" className="object-cover" />
        ) : null}
      </div>
      <div className="flex-1 text-sm">
        <p className="font-medium text-brown">{line.name}</p>
        {unavailable ? (
          <p className="mt-1 text-xs text-gold-deep">No longer available</p>
        ) : (
          <p className="mt-1 text-xs text-muted">Quantity {line.quantity}</p>
        )}
        {unavailable ? (
          <button
            type="button"
            onClick={() => {
              bagStore.update((lines) => removeLine(lines, line.slug));
            }}
            className="mt-2 text-xs text-brown underline-offset-4 hover:underline"
          >
            Remove from bag
          </button>
        ) : null}
      </div>
      <p className="text-sm text-brown">
        {quoteLine && !unavailable ? formatPrice(quoteLine.lineTotal) : ""}
      </p>
    </li>
  );
}
