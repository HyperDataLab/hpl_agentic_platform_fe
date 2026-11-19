import { PlatformRole, UserStatus } from "@/types/enums";

import type { CurrentUser } from "./types";

/** What the app needs from a Firebase account. */
export interface FirebaseAccount {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  metadata: { creationTime?: string; lastSignInTime?: string };
}

/**
 * The session the rest of the app reads, made from the Google account. Everyone signed in is a plain user: there are
 * no platform admins, and a project role comes from the project's own document.
 */
export function toCurrentUser(account: FirebaseAccount): CurrentUser {
  const now = new Date().toISOString();
  const created = account.metadata.creationTime ? new Date(account.metadata.creationTime).toISOString() : now;
  const seen = account.metadata.lastSignInTime ? new Date(account.metadata.lastSignInTime).toISOString() : now;
  const email = account.email ?? "";
  return {
    user: {
      id: email || account.uid,
      email,
      display_name: account.displayName,
      avatar_url: account.photoURL,
      status: UserStatus.Active,
      platform_role: PlatformRole.User,
      email_verified: account.emailVerified,
      onboarded: true,
      created_at: created,
    },
    session: { created_at: seen, last_seen_at: now, idle_expires_at: "", absolute_expires_at: "" },
    memberships: [],
  };
}
