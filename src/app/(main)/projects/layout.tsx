"use client";

import type { ReactNode } from "react";

import { AuthGate } from "@/components/auth/auth-gate";

// Everything under /projects needs an account. The guard runs in the browser: a static export has no server.
export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return <AuthGate>{() => children}</AuthGate>;
}
