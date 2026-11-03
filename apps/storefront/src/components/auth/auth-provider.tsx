"use client";

import { useEffect, type ReactNode } from "react";

import { restoreSession } from "@/lib/session/session";

/** Restores the signed-in session once when the app loads, using the refresh cookie. */
export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void restoreSession();
  }, []);
  return <>{children}</>;
}
