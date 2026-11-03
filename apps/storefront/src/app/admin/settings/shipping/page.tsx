"use client";

import { useEffect, useMemo, useState, type SyntheticEvent } from "react";

import { Button, Field, Notice, TextInput } from "@/components/ui/form";
import { ApiError } from "@/lib/api/errors";
import { formatPrice } from "@/lib/money";
import { authorizedRequest } from "@/lib/session/session";

interface CheckoutSettings {
  flatRate: string;
  freeShippingAbove: string | null;
  taxPercent: string;
}

const MONEY = /^\d{1,8}(\.\d{1,2})?$/;
const PERCENT = /^\d{1,3}(\.\d{1,2})?$/;

/** Shipping and tax used at checkout. Changes apply to the next quote a shopper requests. */
export default function ShippingTaxPage() {
  const [loaded, setLoaded] = useState(false);
  const [flatRate, setFlatRate] = useState("0");
  const [freeEnabled, setFreeEnabled] = useState(false);
  const [freeAbove, setFreeAbove] = useState("");
  const [taxPercent, setTaxPercent] = useState("0");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authorizedRequest<CheckoutSettings>("/admin/settings/checkout")
      .then((rules) => {
        setFlatRate(rules.flatRate);
        setFreeEnabled(rules.freeShippingAbove !== null);
        setFreeAbove(rules.freeShippingAbove ?? "");
        setTaxPercent(rules.taxPercent);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        setNotice({
          tone: "error",
          text: err instanceof ApiError ? err.message : "Could not load the current rules.",
        });
      });
  }, []);

  // The preview uses the same rule as the server: free shipping at or above the threshold, tax on the discounted subtotal.
  const preview = useMemo(() => {
    const flat = Number(flatRate) || 0;
    const threshold = freeEnabled && freeAbove ? Number(freeAbove) : null;
    const rate = Number(taxPercent) || 0;
    return [1000, 3000].map((subtotal) => {
      const shipping = threshold !== null && subtotal >= threshold ? 0 : flat;
      const tax = Math.round(subtotal * rate) / 100;
      return { subtotal, shipping, tax, total: subtotal + shipping + tax };
    });
  }, [flatRate, freeEnabled, freeAbove, taxPercent]);

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    if (!MONEY.test(flatRate.trim()))
      next["flatRate"] = "Enter an amount such as 99 or 99.50 (0 for free shipping)";
    if (freeEnabled && !MONEY.test(freeAbove.trim()))
      next["freeAbove"] = "Enter the order amount where shipping becomes free";
    if (!PERCENT.test(taxPercent.trim()) || Number(taxPercent) > 100)
      next["taxPercent"] = "Enter a percentage from 0 to 100";
    return next;
  };

  const save = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setNotice(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const saved = await authorizedRequest<CheckoutSettings>("/admin/settings/checkout", {
        method: "PUT",
        body: {
          flatRate: flatRate.trim(),
          freeShippingAbove: freeEnabled ? freeAbove.trim() : null,
          taxPercent: taxPercent.trim(),
        },
      });
      setFlatRate(saved.flatRate);
      setTaxPercent(saved.taxPercent);
      setNotice({
        tone: "success",
        text: "Shipping and tax saved. New checkouts use these rules.",
      });
    } catch (err) {
      setNotice({
        tone: "error",
        text: err instanceof ApiError ? err.message : "The rules could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-8">
      <header>
        <p className="text-xs tracking-[0.2em] text-gold-deep uppercase">Settings</p>
        <h1 className="mt-2 font-serif text-3xl text-brown">Shipping and tax</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Set the delivery charge, the order size that ships free, and the tax rate. Shoppers see
          these amounts at checkout, and the server recalculates them on every order.
        </p>
      </header>

      {notice ? (
        <Notice tone={notice.tone === "error" ? "error" : "success"}>{notice.text}</Notice>
      ) : null}

      <form
        onSubmit={(event) => void save(event)}
        noValidate
        className="grid gap-6 lg:grid-cols-[1fr_360px]"
      >
        <section className="grid gap-6 rounded-md border border-line bg-white p-6">
          <h2 className="font-serif text-xl text-brown">Delivery charge</h2>
          <Field
            label="Standard delivery charge (₹)"
            htmlFor="ship-flat"
            error={errors["flatRate"]}
            hint="Charged when the order is below the free-shipping threshold. Enter 0 for free delivery."
          >
            <TextInput
              id="ship-flat"
              value={flatRate}
              onChange={(e) => {
                setFlatRate(e.target.value);
              }}
              inputMode="decimal"
              disabled={!loaded}
            />
          </Field>

          <div className="grid gap-4 rounded-md border border-line p-4">
            <label className="flex items-center gap-2 text-sm text-brown">
              <input
                type="checkbox"
                checked={freeEnabled}
                onChange={(e) => {
                  setFreeEnabled(e.target.checked);
                }}
                className="size-4 accent-brown"
                disabled={!loaded}
              />
              Ship free above an order amount
            </label>
            {freeEnabled ? (
              <Field
                label="Free delivery from (₹)"
                htmlFor="ship-free"
                error={errors["freeAbove"]}
                hint="Orders at or above this amount ship free. The check uses the subtotal before any coupon."
              >
                <TextInput
                  id="ship-free"
                  value={freeAbove}
                  onChange={(e) => {
                    setFreeAbove(e.target.value);
                  }}
                  inputMode="decimal"
                />
              </Field>
            ) : null}
          </div>

          <h2 className="font-serif text-xl text-brown">Tax</h2>
          <Field
            label="Tax rate (%)"
            htmlFor="tax"
            error={errors["taxPercent"]}
            hint="Applied to the subtotal after any coupon. Confirm the rate for your products with your accountant. Enter 0 for none."
          >
            <TextInput
              id="tax"
              value={taxPercent}
              onChange={(e) => {
                setTaxPercent(e.target.value);
              }}
              inputMode="decimal"
              disabled={!loaded}
            />
          </Field>

          <div>
            <Button type="submit" disabled={saving || !loaded}>
              {saving ? "Saving…" : "Save shipping and tax"}
            </Button>
          </div>
        </section>

        <aside className="h-fit rounded-md border border-line bg-cream-deep/60 p-6">
          <h2 className="font-serif text-xl text-brown">What a shopper pays</h2>
          <p className="mt-1 text-xs text-muted">
            Preview only. The checkout calculates the real amounts.
          </p>
          <div className="mt-5 grid gap-5">
            {preview.map((row) => (
              <dl key={row.subtotal} className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Order of {formatPrice(String(row.subtotal))}</dt>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Delivery</dt>
                  <dd>{row.shipping === 0 ? "Free" : formatPrice(String(row.shipping))}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Tax</dt>
                  <dd>{formatPrice(String(row.tax))}</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-2 font-medium text-brown">
                  <dt>Total</dt>
                  <dd>{formatPrice(String(row.total))}</dd>
                </div>
              </dl>
            ))}
          </div>
        </aside>
      </form>
    </div>
  );
}
