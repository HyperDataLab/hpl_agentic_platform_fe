"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

import { LOGIN_PATH } from "@/lib/auth/auth-config";
import { useAppSelector } from "@/lib/redux/hooks";
import { selectAuth } from "@/lib/redux/slices/auth-slice";

/** The home page: the projects for a signed-in account, otherwise the sign-in page. */
export function SessionRedirect() {
  const router = useRouter();
  const { initialized, isAuthenticated } = useAppSelector(selectAuth);

  useEffect(() => {
    if (initialized) router.replace(isAuthenticated ? "/projects" : LOGIN_PATH);
  }, [initialized, isAuthenticated, router]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4" aria-busy="true">
      <p role="status" className="text-muted-foreground text-sm">
        Checking your sign-in...
      </p>
    </main>
  );
}
