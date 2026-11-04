"use client";

import { useEffect, type ReactNode } from "react";

import { startSavedItemsSync } from "@/lib/saved/saved-items-sync";
import { restoreSession } from "@/lib/session/session";

/**
 * Restores the signed-in session once when the app loads, using the refresh cookie.
 * Also keeps the bag and wishlist in step with the server while someone is signed in.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const stopSync = startSavedItemsSync();
    void restoreSession();
    return stopSync;
  }, []);
  return <>{children}</>;
}
