"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

/** Sends the browser on to `to` once the page loads: a static export has no server to answer with a redirect. */
export function ClientRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);
  return null;
}
