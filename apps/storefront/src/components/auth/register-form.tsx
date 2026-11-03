"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type SyntheticEvent } from "react";

import { ApiError } from "@/lib/api/errors";
import { signUp } from "@/lib/session/session";
import { Button, Field, Notice, TextInput } from "@/components/ui/form";

const PHONE = /^\+?[0-9]{10,15}$/;

export function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!values.firstName.trim()) next["firstName"] = "Enter your first name";
    if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) next["email"] = "Enter a valid email address";
    if (values.phone.trim() && !PHONE.test(values.phone.trim()))
      next["phone"] = "Enter a 10-digit mobile number";
    if (
      values.password.length < 8 ||
      !/[A-Za-z]/.test(values.password) ||
      !/\d/.test(values.password)
    ) {
      next["password"] = "Use at least 8 characters, with a letter and a number";
    }
    return next;
  };

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setError(null);
    try {
      await signUp({
        email: values.email.trim(),
        password: values.password,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim() || undefined,
        phone: values.phone.trim() || undefined,
      });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We could not create your account. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:px-0">
      <h1 className="font-serif text-3xl text-brown">Create your account</h1>
      <p className="mt-2 text-sm text-muted">
        Track your orders, save addresses and check out faster.
      </p>

      <form onSubmit={(event) => void submit(event)} noValidate className="mt-8 grid gap-5">
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="First name" htmlFor="reg-first" error={errors["firstName"]}>
            <TextInput
              id="reg-first"
              autoComplete="given-name"
              value={values.firstName}
              onChange={(e) => {
                set("firstName", e.target.value);
              }}
            />
          </Field>
          <Field label="Last name" htmlFor="reg-last">
            <TextInput
              id="reg-last"
              autoComplete="family-name"
              value={values.lastName}
              onChange={(e) => {
                set("lastName", e.target.value);
              }}
            />
          </Field>
        </div>
        <Field label="Email" htmlFor="reg-email" error={errors["email"]}>
          <TextInput
            id="reg-email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => {
              set("email", e.target.value);
            }}
          />
        </Field>
        <Field label="Mobile number (optional)" htmlFor="reg-phone" error={errors["phone"]}>
          <TextInput
            id="reg-phone"
            type="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(e) => {
              set("phone", e.target.value);
            }}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="reg-password"
          error={errors["password"]}
          hint="At least 8 characters, with a letter and a number."
        >
          <TextInput
            id="reg-password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => {
              set("password", e.target.value);
            }}
          />
        </Field>
        <Button type="submit" disabled={busy} className="w-full py-3.5">
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="text-brown underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
