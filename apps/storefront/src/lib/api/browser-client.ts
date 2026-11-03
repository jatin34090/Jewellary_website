"use client";

// Browser-side API calls for public data (load more, bag and wishlist refresh).
// Signed-in calls go through lib/session/session.ts, which adds the bearer token.

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

export function browserGet<T>(path: string): Promise<T> {
  return browserRequest<T>(path, "GET");
}

export function browserPost<T>(path: string, body: unknown): Promise<T> {
  return browserRequest<T>(path, "POST", body);
}

async function browserRequest<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : null,
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    SuccessEnvelope<T> | ErrorEnvelope | null;

  if (!response.ok || !payload || !payload.success) {
    const error = payload && !payload.success ? payload.error : undefined;
    throw new ApiError(response.status, error?.code ?? "ERROR", error?.message ?? "Request failed");
  }
  return payload.data;
}
