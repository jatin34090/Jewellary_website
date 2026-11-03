"use client";

// Signed-in session for the browser. The access token lives in memory only, never in localStorage.
// The refresh token is an HttpOnly cookie the API sets, so page scripts cannot read it.

import { API_BASE_URL } from "../api/base-url";
import { ApiError } from "../api/errors";

export type UserRole = "CUSTOMER" | "STAFF" | "ADMIN";

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  role: UserRole;
  createdAt?: string;
}

export interface SessionSnapshot {
  status: "loading" | "authenticated" | "anonymous";
  user: SessionUser | null;
}

interface AuthPayload {
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
}

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string };
}

let accessToken: string | null = null;
let snapshot: SessionSnapshot = { status: "loading", user: null };
let refreshing: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

const SERVER_SNAPSHOT: SessionSnapshot = { status: "loading", user: null };

function publish(next: SessionSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSessionSnapshot(): SessionSnapshot {
  return snapshot;
}

export function getServerSessionSnapshot(): SessionSnapshot {
  return SERVER_SNAPSHOT;
}

async function parse<T>(response: Response): Promise<T> {
  // 204 No Content (for example after a delete) has no body to read.
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as
    SuccessEnvelope<T> | ErrorEnvelope | null;
  if (!response.ok || !body || !body.success) {
    const error = body && !body.success ? body.error : undefined;
    throw new ApiError(response.status, error?.code ?? "ERROR", error?.message ?? "Request failed");
  }
  return body.data;
}

function acceptSession(payload: AuthPayload): void {
  accessToken = payload.accessToken;
  publish({ status: "authenticated", user: payload.user });
}

function clearSession(): void {
  accessToken = null;
  publish({ status: "anonymous", user: null });
}

/** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
function refresh(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      acceptSession(await parse<AuthPayload>(response));
      return true;
    } catch {
      clearSession();
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Called once when the app loads: restores the session from the refresh cookie if one exists. */
export async function restoreSession(): Promise<void> {
  if (snapshot.status !== "loading") return;
  await refresh();
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = await parse<AuthPayload>(response);
  acceptSession(payload);
  return payload.user;
}

export async function signUp(input: {
  email: string;
  password: string;
  firstName: string;
  lastName?: string | undefined;
  phone?: string | undefined;
}): Promise<SessionUser> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await parse<AuthPayload>(response);
  acceptSession(payload);
  return payload.user;
}

export async function signOut(): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" }).catch(
    () => undefined,
  );
  clearSession();
}

/**
 * Calls a protected endpoint with the access token. On a 401 it refreshes the session once and
 * retries, so a token that expired in the background does not surface as an error.
 */
export async function authorizedRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  if (!accessToken && snapshot.status === "loading") await restoreSession();

  const send = () => {
    const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    return fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      cache: "no-store",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : null,
    });
  };

  let response = await send();
  if (response.status === 401 && (await refresh())) {
    response = await send();
  }
  if (response.status === 401) {
    clearSession();
  }
  return parse<T>(response);
}
