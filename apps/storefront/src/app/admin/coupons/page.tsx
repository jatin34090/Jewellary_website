"use client";

import { useEffect, useState, type SyntheticEvent } from "react";

import { Button, Field, Notice, SelectInput, TextInput } from "@/components/ui/form";
import type { AdminCoupon } from "@/components/admin/types";
import { ApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/orders/labels";
import { formatPrice } from "@/lib/money";
import { authorizedRequest } from "@/lib/session/session";

const MONEY = /^\d{1,8}(\.\d{1,2})?$/;

const EMPTY = {
  code: "",
  description: "",
  discountType: "PERCENTAGE" as "PERCENTAGE" | "FIXED_AMOUNT",
  discountValue: "",
  maxDiscountAmount: "",
  minOrderAmount: "",
  usageLimit: "",
  expiresAt: "",
};

/** Discount codes. Validity, minimum order and usage limits are enforced by the server at checkout. */
export default function CouponsPage() {
  const [coupons, setCoupons] = useState<AdminCoupon[] | null>(null);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    authorizedRequest<AdminCoupon[]>("/admin/coupons")
      .then(setCoupons)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Could not load coupons.");
      });

  useEffect(() => {
    void load();
  }, []);

  const set = (key: keyof typeof EMPTY, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!/^[A-Z0-9][A-Z0-9_-]{2,38}[A-Z0-9]$/.test(values.code.trim().toUpperCase())) {
      next["code"] = "Use 4 to 40 letters, digits, hyphens or underscores";
    }
    if (!MONEY.test(values.discountValue.trim())) next["discountValue"] = "Enter a positive value";
    if (values.discountType === "PERCENTAGE" && Number(values.discountValue) > 100)
      next["discountValue"] = "A percentage cannot exceed 100";
    if (values.maxDiscountAmount.trim() && !MONEY.test(values.maxDiscountAmount.trim()))
      next["maxDiscountAmount"] = "Enter a valid amount";
    if (values.minOrderAmount.trim() && !MONEY.test(values.minOrderAmount.trim()))
      next["minOrderAmount"] = "Enter a valid amount";
    return next;
  };

  const create = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setMessage(null);
    setError(null);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      await authorizedRequest("/admin/coupons", {
        method: "POST",
        body: {
          code: values.code.trim().toUpperCase(),
          description: values.description.trim() || undefined,
          discountType: values.discountType,
          discountValue: values.discountValue.trim(),
          maxDiscountAmount: values.maxDiscountAmount.trim() || undefined,
          minOrderAmount: values.minOrderAmount.trim() || undefined,
          usageLimit: values.usageLimit ? Number(values.usageLimit) : undefined,
          expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : undefined,
        },
      });
      setValues(EMPTY);
      setMessage("Coupon created.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The coupon could not be created.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (coupon: AdminCoupon) => {
    setError(null);
    try {
      await authorizedRequest(`/admin/coupons/${coupon.id}`, {
        method: "PATCH",
        body: { isActive: !coupon.isActive },
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The coupon could not be updated.");
    }
  };

  return (
    <div className="grid gap-8">
      <header>
        <p className="text-xs tracking-[0.2em] text-gold-deep uppercase">Offers</p>
        <h1 className="mt-2 font-serif text-3xl text-brown">Coupons</h1>
      </header>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}

      <form
        onSubmit={(event) => void create(event)}
        noValidate
        className="grid gap-5 rounded-md border border-line bg-white p-6 sm:grid-cols-3"
      >
        <h2 className="font-serif text-xl text-brown sm:col-span-3">New coupon</h2>
        <Field label="Code" htmlFor="cp-code" error={errors["code"]}>
          <TextInput
            id="cp-code"
            value={values.code}
            onChange={(e) => {
              set("code", e.target.value.toUpperCase());
            }}
            maxLength={40}
            placeholder="WELCOME10"
          />
        </Field>
        <Field label="Type" htmlFor="cp-type">
          <SelectInput
            id="cp-type"
            value={values.discountType}
            onChange={(e) => {
              set("discountType", e.target.value);
            }}
          >
            <option value="PERCENTAGE">Percentage off</option>
            <option value="FIXED_AMOUNT">Fixed amount off (₹)</option>
          </SelectInput>
        </Field>
        <Field
          label={values.discountType === "PERCENTAGE" ? "Percent" : "Amount (₹)"}
          htmlFor="cp-value"
          error={errors["discountValue"]}
        >
          <TextInput
            id="cp-value"
            value={values.discountValue}
            onChange={(e) => {
              set("discountValue", e.target.value);
            }}
            inputMode="decimal"
          />
        </Field>
        <Field
          label="Maximum discount (₹)"
          htmlFor="cp-max"
          error={errors["maxDiscountAmount"]}
          hint="Caps a percentage discount"
        >
          <TextInput
            id="cp-max"
            value={values.maxDiscountAmount}
            onChange={(e) => {
              set("maxDiscountAmount", e.target.value);
            }}
            inputMode="decimal"
          />
        </Field>
        <Field label="Minimum order (₹)" htmlFor="cp-min" error={errors["minOrderAmount"]}>
          <TextInput
            id="cp-min"
            value={values.minOrderAmount}
            onChange={(e) => {
              set("minOrderAmount", e.target.value);
            }}
            inputMode="decimal"
          />
        </Field>
        <Field label="Usage limit" htmlFor="cp-limit" hint="Leave empty for unlimited">
          <TextInput
            id="cp-limit"
            value={values.usageLimit}
            onChange={(e) => {
              set("usageLimit", e.target.value);
            }}
            inputMode="numeric"
          />
        </Field>
        <Field label="Expires on (optional)" htmlFor="cp-exp">
          <TextInput
            id="cp-exp"
            type="datetime-local"
            value={values.expiresAt}
            onChange={(e) => {
              set("expiresAt", e.target.value);
            }}
          />
        </Field>
        <Field label="Description (internal)" htmlFor="cp-desc" className="sm:col-span-2">
          <TextInput
            id="cp-desc"
            value={values.description}
            onChange={(e) => {
              set("description", e.target.value);
            }}
            maxLength={255}
          />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create coupon"}
          </Button>
        </div>
      </form>

      <section className="overflow-x-auto rounded-md border border-line bg-white">
        {coupons === null ? (
          <p className="p-6 text-sm text-muted">Loading coupons…</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line bg-cream-deep/50 text-xs tracking-wide text-brown-soft uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Offer</th>
                <th className="px-4 py-3 font-medium">Used</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    No coupons yet.
                  </td>
                </tr>
              ) : (
                coupons.map((coupon) => (
                  <tr key={coupon.id}>
                    <td className="px-4 py-3 font-medium text-brown">{coupon.code}</td>
                    <td className="px-4 py-3 text-brown-soft">
                      {coupon.discountType === "PERCENTAGE"
                        ? `${Number(coupon.discountValue)}% off`
                        : `${formatPrice(coupon.discountValue)} off`}
                      {coupon.minOrderAmount !== "0.00" ? (
                        <span className="block text-xs text-muted">
                          Min order {formatPrice(coupon.minOrderAmount)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-brown-soft">
                      {coupon.usedCount}
                      {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}
                    </td>
                    <td className="px-4 py-3 text-brown-soft">
                      {coupon.expiresAt ? formatDate(coupon.expiresAt) : "No expiry"}
                    </td>
                    <td className="px-4 py-3 text-xs">{coupon.isActive ? "Active" : "Paused"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void toggle(coupon)}
                        className="text-brown underline-offset-4 hover:underline"
                      >
                        {coupon.isActive ? "Pause" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
