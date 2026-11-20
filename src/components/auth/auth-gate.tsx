"use client";

import { type ReactNode, useEffect } from "react";

import { usePathname, useRouter } from "next/navigation";

import { PageSkeleton } from "@/app/(main)/_components/page-skeleton";
import { type AuthUser, LOGIN_PATH, toAuthUser } from "@/lib/auth/auth-config";
import { useAppSelector } from "@/lib/redux/hooks";
import { selectAuth } from "@/lib/redux/slices/auth-slice";

/** The signed-in account as the app's pages read it, or null until Firebase has restored the session. */
export function useAuthUser(projectId?: string): AuthUser | null {
  const { user, session, memberships, isAuthenticated } = useAppSelector(selectAuth);
  if (!isAuthenticated || !user || !session) return null;
  return toAuthUser({ user, session, memberships }, projectId);
}

/** Where the login page sends the person back to once they are signed in. */
export function loginUrl(pathname: string, search: string) {
  const next = `${pathname}${search}`;
  return next && next !== "/" ? `${LOGIN_PATH}?${new URLSearchParams({ next })}` : LOGIN_PATH;
}

/**
 * The client-side guard for pages that need an account: a static export has no server to check the session first.
 * Until Firebase has restored the session it shows `fallback`; signed out, it sends the browser to the login page.
 * Firestore rules and the worker enforce access either way: this only decides what to show.
 */
export function AuthGate({
  children,
  fallback = <PageSkeleton />,
}: {
  children: (user: AuthUser) => ReactNode;
  fallback?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { initialized, isAuthenticated } = useAppSelector(selectAuth);
  const user = useAuthUser();

  useEffect(() => {
    if (initialized && !isAuthenticated) router.replace(loginUrl(pathname, window.location.search));
  }, [initialized, isAuthenticated, pathname, router]);

  if (!user) return <div className="p-4 md:p-6">{fallback}</div>;
  return <>{children(user)}</>;
}
