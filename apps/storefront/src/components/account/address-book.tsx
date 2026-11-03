"use client";

import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/errors";
import { authorizedRequest } from "@/lib/session/session";
import { Button, Notice } from "@/components/ui/form";
import { AddressForm, type AddressRecord } from "./address-form";

export function AddressBook() {
  const [addresses, setAddresses] = useState<AddressRecord[] | null>(null);
  const [editing, setEditing] = useState<AddressRecord | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setAddresses(await authorizedRequest<AddressRecord[]>("/addresses"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your addresses.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const makeDefault = async (address: AddressRecord) => {
    try {
      await authorizedRequest(`/addresses/${address.id}`, {
        method: "PATCH",
        body: { isDefault: true },
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the address.");
    }
  };

  const remove = async (address: AddressRecord) => {
    if (!window.confirm("Delete this address?")) return;
    try {
      await authorizedRequest(`/addresses/${address.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete the address.");
    }
  };

  return (
    <section
      aria-labelledby="addresses-heading"
      className="rounded-md border border-line bg-white p-6"
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id="addresses-heading" className="font-serif text-2xl text-brown">
          Addresses
        </h2>
        {editing === null ? (
          <Button
            variant="secondary"
            onClick={() => {
              setEditing("new");
            }}
          >
            Add address
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="mb-4">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}

      {editing !== null ? (
        <div className="mb-6 rounded-md bg-cream-deep/50 p-5">
          <AddressForm
            initial={editing === "new" ? undefined : editing}
            onCancel={() => {
              setEditing(null);
            }}
            onSaved={() => {
              setEditing(null);
              void load();
            }}
          />
        </div>
      ) : null}

      {addresses === null ? (
        <p className="text-sm text-muted">Loading addresses…</p>
      ) : addresses.length === 0 ? (
        <p className="text-sm text-muted">No saved addresses yet.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="rounded-md border border-line p-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-brown">
                  {address.fullName}
                  {address.label ? (
                    <span className="ml-2 text-xs text-muted">({address.label})</span>
                  ) : null}
                </p>
                {address.isDefault ? (
                  <span className="rounded bg-brown px-2 py-0.5 text-[11px] tracking-wide text-cream uppercase">
                    Default
                  </span>
                ) : null}
              </div>
              <p className="mt-2 leading-relaxed text-brown-soft">
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}
                <br />
                {address.city}, {address.state} {address.postalCode}
                <br />
                {address.phone}
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-xs">
                <button
                  type="button"
                  className="text-brown underline-offset-4 hover:underline"
                  onClick={() => {
                    setEditing(address);
                  }}
                >
                  Edit
                </button>
                {!address.isDefault ? (
                  <button
                    type="button"
                    className="text-brown underline-offset-4 hover:underline"
                    onClick={() => void makeDefault(address)}
                  >
                    Make default
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-[#a33b32] underline-offset-4 hover:underline"
                  onClick={() => void remove(address)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
