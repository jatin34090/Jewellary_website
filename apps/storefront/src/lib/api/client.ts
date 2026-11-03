import "server-only";

// Server-side API client. Pages and server components use this. Browser code uses browser-client.ts,
// so the two entry points cannot be mixed up by accident.

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

export interface FetchOptions {
  /** Seconds to keep a cached response (ISR). Catalogue reads use a short window. */
  revalidate?: number;
}

/**
 * GET from the API and unwrap the `{ success, data }` envelope.
 * Throws ApiError for HTTP or envelope errors. Use apiGetOrNull() when a 404 is an expected outcome.
 */
export async function apiGet<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: options.revalidate ?? 60 },
  });

  const body = (await response.json().catch(() => null)) as
    SuccessEnvelope<T> | ErrorEnvelope | null;

  if (!response.ok || !body || !body.success) {
    const error = body && !body.success ? body.error : undefined;
    throw new ApiError(response.status, error?.code ?? "ERROR", error?.message ?? "Request failed");
  }
  return body.data;
}

export async function apiGetOrNull<T>(path: string, options: FetchOptions = {}): Promise<T | null> {
  try {
    return await apiGet<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
