"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type SyntheticEvent } from "react";

import { ApiError } from "@/lib/api/errors";
import { signIn } from "@/lib/session/session";
import { Button, Field, Notice, TextInput } from "@/components/ui/form";

export function LoginForm({
  next,
  title,
  adminHint,
}: {
  next: string;
  title: string;
  adminHint?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await signIn(email.trim(), password);
      // Staff without an explicit destination land in the admin panel.
      const fallback = user.role === "CUSTOMER" ? "/account" : "/admin";
      router.replace(next !== "/" ? next : fallback);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:px-0">
      <h1 className="font-serif text-3xl text-brown">{title}</h1>
      {adminHint ? (
        <p className="mt-2 text-sm text-muted">Staff and admin accounts sign in here as well.</p>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Sign in to check out, track orders and manage your addresses.
        </p>
      )}

      <form onSubmit={(event) => void submit(event)} noValidate className="mt-8 grid gap-5">
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Field label="Email" htmlFor="login-email">
          <TextInput
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
          />
        </Field>
        <Field label="Password" htmlFor="login-password">
          <TextInput
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
            }}
          />
        </Field>
        <Button type="submit" disabled={busy} className="w-full py-3.5">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {!adminHint ? (
        <p className="mt-6 text-center text-sm text-muted">
          New to VRINOOR?{" "}
          <Link
            href={`/register?next=${encodeURIComponent(next)}`}
            className="text-brown underline underline-offset-4"
          >
            Create an account
          </Link>
        </p>
      ) : null}
    </div>
  );
}
