"use client";

// Browser-side API calls, used by client components (load more, bag and wishlist refresh).
// Requests are not cached by Next; the browser's own HTTP cache applies.

import { API_BASE_URL } from "./base-url";
import { ApiError } from "./errors";

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string };
}

export async function browserGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    SuccessEnvelope<T> | ErrorEnvelope | null;

  if (!response.ok || !body || !body.success) {
    const error = body && !body.success ? body.error : undefined;
    throw new ApiError(response.status, error?.code ?? "ERROR", error?.message ?? "Request failed");
  }
  return body.data;
}
