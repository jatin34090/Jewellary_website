"use client";

import { useSyncExternalStore } from "react";

import type { LocalStore } from "./local-store";

/** Subscribes a component to a local store. Re-renders when the value changes in this tab or another. */
export function useLocalStore<T>(store: LocalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
