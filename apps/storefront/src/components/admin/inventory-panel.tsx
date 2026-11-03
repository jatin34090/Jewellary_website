"use client";

import { useState, type SyntheticEvent } from "react";

import { Button, Field, Notice, SelectInput, TextInput } from "@/components/ui/form";
import { ApiError } from "@/lib/api/errors";
import { authorizedRequest } from "@/lib/session/session";
import type { AdminProduct } from "./types";

const STATUS_LABEL = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock",
} as const;

/** Stock levels and a set/adjust form. Every change is recorded in the audit log on the server. */
export function InventoryPanel({
  product,
  onChange,
}: {
  product: AdminProduct;
  onChange: (next: AdminProduct) => void;
}) {
  const [mode, setMode] = useState<"SET" | "ADJUST">("ADJUST");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inv = product.inventory;

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || (mode === "SET" && amount < 0)) {
      setError(
        mode === "SET"
          ? "Enter the new stock level (0 or more)."
          : "Enter a whole number to add or remove.",
      );
      return;
    }
    if (reason.trim().length < 3) {
      setError("Add a short reason, for example 'Restock from supplier'.");
      return;
    }
    setBusy(true);
    try {
      await authorizedRequest(`/admin/products/${product.id}/inventory`, {
        method: "PATCH",
        body: { mode, quantity: amount, reason: reason.trim() },
      });
      onChange(await authorizedRequest<AdminProduct>(`/admin/products/${product.id}`));
      setQuantity("");
      setReason("");
      setMessage("Stock updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Stock could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="stock-heading"
      className="grid gap-6 rounded-md border border-line bg-white p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="stock-heading" className="font-serif text-xl text-brown">
          Stock
        </h2>
        {inv ? (
          <span className="rounded bg-cream-deep px-3 py-1 text-xs text-brown-soft">
            {STATUS_LABEL[inv.availability]}
          </span>
        ) : null}
      </div>

      {inv ? (
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Stat label="On hand" value={inv.quantityOnHand} />
          <Stat label="Reserved" value={inv.quantityReserved} />
          <Stat label="Sellable" value={inv.quantityOnHand - inv.quantityReserved} />
          <Stat label="Low-stock alert" value={inv.lowStockThreshold} />
        </dl>
      ) : (
        <p className="text-sm text-muted">No stock record for this product.</p>
      )}

      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}

      {inv ? (
        <form
          onSubmit={(event) => void submit(event)}
          noValidate
          className="grid gap-4 sm:grid-cols-[180px_160px_1fr_auto] sm:items-end"
        >
          <Field label="Change" htmlFor="stock-mode">
            <SelectInput
              id="stock-mode"
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as "SET" | "ADJUST");
              }}
            >
              <option value="ADJUST">Add or remove</option>
              <option value="SET">Set to exact amount</option>
            </SelectInput>
          </Field>
          <Field label={mode === "SET" ? "New on-hand" : "Units (+ or −)"} htmlFor="stock-qty">
            <TextInput
              id="stock-qty"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
              }}
              inputMode="numeric"
              placeholder={mode === "SET" ? "e.g. 12" : "e.g. -2 or 5"}
            />
          </Field>
          <Field label="Reason" htmlFor="stock-reason">
            <TextInput
              id="stock-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
              }}
              maxLength={200}
              placeholder="Restock, damage, recount…"
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Update stock"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-line p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-serif text-2xl text-brown">{value}</dd>
    </div>
  );
}
