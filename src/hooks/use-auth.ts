"use client";

import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { toast } from "sonner";

import { firebaseAuth } from "@/lib/firebase/client";
import { LAB_DOMAIN, labEmail } from "@/lib/firebase/config";
import { useAppSelector } from "@/lib/redux/hooks";
import { selectAuth } from "@/lib/redux/slices/auth-slice";
import { ProjectRole } from "@/types/enums";

/** Where to go after signing in: the `next` page when it is one of ours, otherwise the projects. */
export function destination() {
  const next = new URLSearchParams(window.location.search).get("next");
  const fallback = "/projects";
  if (!next?.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  const target = new URL(next, window.location.origin);
  if (target.origin !== window.location.origin) return fallback;
  return ["/projects", "/settings"].some((path) => target.pathname === path || target.pathname.startsWith(`${path}/`))
    ? `${target.pathname}${target.search}${target.hash}`
    : fallback;
}

/**
 * Signs in with Google, limited to the lab's domain. Resolves to an error to show, or null once signed in (or when the
 * person closed the popup).
 */
export async function signInWithGoogle(): Promise<string | null> {
  const auth = firebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: LAB_DOMAIN, prompt: "select_account" });
  try {
    const result = await signInWithPopup(auth, provider);
    if (!labEmail(result.user.email) || !result.user.emailVerified) {
      await signOut(auth);
      return `${result.user.email ?? "This account"} is not a verified @${LAB_DOMAIN} account.`;
    }
    return null;
  } catch (cause) {
    const code = (cause as { code?: string }).code;
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return null;
    if (code === "auth/operation-not-allowed" || code === "auth/configuration-not-found")
      return "Google sign-in is not enabled for this Firebase project yet.";
    if (code === "auth/popup-blocked") return "The browser blocked the sign-in window. Allow pop-ups and try again.";
    return "Unable to sign in. Please try again.";
  }
}

export function useAuth(projectId?: string) {
  const auth = useAppSelector(selectAuth);
  const projectRole: ProjectRole | undefined = auth.memberships.find((item) => item.project_id === projectId)?.role;

  const logout = async (_allDevices = false) => {
    await signOut(firebaseAuth());
    toast.success("Signed out successfully.");
  };
  return {
    ...auth,
    isAdmin: false,
    projectRole,
    isProjectManager: projectRole === ProjectRole.ProjectManager,
    isResearcher: projectRole === ProjectRole.Researcher,
    isReviewer: projectRole === ProjectRole.Reviewer,
    signInWithGoogle,
    logout,
  };
}
