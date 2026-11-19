"use client";

import { useEffect } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { toast } from "sonner";

import { LOGIN_PATH } from "@/lib/auth/auth-config";
import { toCurrentUser } from "@/lib/auth/firebase-user";
import { firebaseAuth } from "@/lib/firebase/client";
import { LAB_DOMAIN, labEmail } from "@/lib/firebase/config";
import { useAppDispatch } from "@/lib/redux/hooks";
import { logout, setSession } from "@/lib/redux/slices/auth-slice";

/**
 * Keeps the store's session in step with Firebase Auth. Firebase shares the sign-in between tabs itself, so signing out
 * in one tab signs out the others. An account outside the lab's domain is signed out at once.
 */
export function useAuthSyncAcrossTabs() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  useEffect(() => {
    const auth = firebaseAuth();
    let signedIn = false;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && (!labEmail(user.email) || !user.emailVerified)) {
        void signOut(auth);
        toast.error(`Only verified @${LAB_DOMAIN} accounts can sign in.`, { description: user.email ?? undefined });
        return;
      }
      if (user) {
        signedIn = true;
        dispatch(setSession(toCurrentUser(user)));
        return;
      }
      dispatch(logout());
      void queryClient.cancelQueries();
      queryClient.clear();
      // Signed out elsewhere (another tab, an expired account) while on a page that needs an account.
      if (signedIn && !window.location.pathname.startsWith("/auth/")) window.location.replace(LOGIN_PATH);
      signedIn = false;
    });
    // A request the worker refused for the account: sign out, which the listener above turns into the login page.
    const expire = () => void signOut(auth);
    window.addEventListener("auth:expired", expire);
    return () => {
      unsubscribe();
      window.removeEventListener("auth:expired", expire);
    };
  }, [dispatch, queryClient]);
}
