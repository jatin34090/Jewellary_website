"use client";

import { useSyncExternalStore } from "react";

import {
  getServerSessionSnapshot,
  getSessionSnapshot,
  subscribeSession,
  type SessionSnapshot,
} from "./session";

/** Current session state. Starts as "loading" on the server and during hydration. */
export function useSession(): SessionSnapshot {
  return useSyncExternalStore(subscribeSession, getSessionSnapshot, getServerSessionSnapshot);
}
