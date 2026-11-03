"use client";

import { useState, type SyntheticEvent } from "react";

import { authorizedRequest } from "@/lib/session/session";
import { ApiError } from "@/lib/api/errors";
import { Button, Field, Notice, TextInput } from "@/components/ui/form";

export interface AddressRecord {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

interface AddressFormProps {
  initial?: AddressRecord | undefined;
  onSaved: (address: AddressRecord) => void;
  onCancel?: (() => void) | undefined;
}

const PHONE = /^\+?[0-9]{10,15}$/;
const PIN = /^[1-9][0-9]{5}$/;

/** Create or edit a delivery address. Validation mirrors the API so most mistakes show before a request. */
export function AddressForm({ initial, onSaved, onCancel }: AddressFormProps) {
  const [values, setValues] = useState({
    label: initial?.label ?? "",
    fullName: initial?.fullName ?? "",
    phone: initial?.phone ?? "",
    line1: initial?.line1 ?? "",
    line2: initial?.line2 ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    postalCode: initial?.postalCode ?? "",
    isDefault: initial?.isDefault ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof values, value: string | boolean) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    if (values.fullName.trim().length < 2) next["fullName"] = "Enter the recipient's full name";
    if (!PHONE.test(values.phone.trim())) next["phone"] = "Enter a 10-digit mobile number";
    if (values.line1.trim().length < 5) next["line1"] = "Enter the house number and street";
    if (values.city.trim().length < 2) next["city"] = "Enter the city";
    if (values.state.trim().length < 2) next["state"] = "Enter the state";
    if (!PIN.test(values.postalCode.trim())) next["postalCode"] = "Enter a valid 6-digit PIN code";
    return next;
  };

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    setFormError(null);
    const body = {
      label: values.label.trim() || undefined,
      fullName: values.fullName.trim(),
      phone: values.phone.trim(),
      line1: values.line1.trim(),
      line2: values.line2.trim() || undefined,
      city: values.city.trim(),
      state: values.state.trim(),
      postalCode: values.postalCode.trim(),
      isDefault: values.isDefault,
    };
    try {
      const saved = initial
        ? await authorizedRequest<AddressRecord>(`/addresses/${initial.id}`, {
            method: "PATCH",
            body,
          })
        : await authorizedRequest<AddressRecord>("/addresses", { method: "POST", body });
      onSaved(saved);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "We could not save the address. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-4 sm:grid-cols-2">
      {formError ? (
        <div className="sm:col-span-2">
          <Notice tone="error">{formError}</Notice>
        </div>
      ) : null}

      <Field label="Full name" htmlFor="addr-name" error={errors["fullName"]}>
        <TextInput
          id="addr-name"
          value={values.fullName}
          onChange={(e) => {
            set("fullName", e.target.value);
          }}
          autoComplete="name"
        />
      </Field>
      <Field label="Mobile number" htmlFor="addr-phone" error={errors["phone"]}>
        <TextInput
          id="addr-phone"
          value={values.phone}
          onChange={(e) => {
            set("phone", e.target.value);
          }}
          inputMode="tel"
          autoComplete="tel"
        />
      </Field>
      <Field
        label="Address line 1"
        htmlFor="addr-line1"
        error={errors["line1"]}
        className="sm:col-span-2"
      >
        <TextInput
          id="addr-line1"
          value={values.line1}
          onChange={(e) => {
            set("line1", e.target.value);
          }}
          autoComplete="address-line1"
          placeholder="House no., street"
        />
      </Field>
      <Field label="Address line 2 (optional)" htmlFor="addr-line2" className="sm:col-span-2">
        <TextInput
          id="addr-line2"
          value={values.line2}
          onChange={(e) => {
            set("line2", e.target.value);
          }}
          autoComplete="address-line2"
          placeholder="Area, landmark"
        />
      </Field>
      <Field label="City" htmlFor="addr-city" error={errors["city"]}>
        <TextInput
          id="addr-city"
          value={values.city}
          onChange={(e) => {
            set("city", e.target.value);
          }}
          autoComplete="address-level2"
        />
      </Field>
      <Field label="State" htmlFor="addr-state" error={errors["state"]}>
        <TextInput
          id="addr-state"
          value={values.state}
          onChange={(e) => {
            set("state", e.target.value);
          }}
          autoComplete="address-level1"
        />
      </Field>
      <Field label="PIN code" htmlFor="addr-pin" error={errors["postalCode"]}>
        <TextInput
          id="addr-pin"
          value={values.postalCode}
          onChange={(e) => {
            set("postalCode", e.target.value);
          }}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
        />
      </Field>
      <Field label="Label (optional)" htmlFor="addr-label" hint="For example: Home or Office">
        <TextInput
          id="addr-label"
          value={values.label}
          onChange={(e) => {
            set("label", e.target.value);
          }}
          maxLength={50}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-brown sm:col-span-2">
        <input
          type="checkbox"
          checked={values.isDefault}
          onChange={(e) => {
            set("isDefault", e.target.checked);
          }}
          className="size-4 accent-brown"
        />
        Use as my default address
      </label>

      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save address" : "Add address"}
        </Button>
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
