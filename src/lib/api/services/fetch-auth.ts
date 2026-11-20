import { toCurrentUser } from "@/lib/auth/firebase-user";
import type { CurrentUser, UserProfile } from "@/lib/auth/types";
import { ApiError, type ApiResult } from "@/types/api";

import apiService from "../core";

export type CurrentUserResponse = ApiResult<CurrentUser>;

/**
 * The signed-in account. Accounts sign in with Google through Firebase Auth (see `use-auth.ts`); there are no email
 * codes, sign-in links or server sessions any more.
 */
export const fetchAuth = {
  /** Profiles are the Google account's; the worker has no profile API yet, so these fail with its 404. */
  updateProfile: async (data: { display_name: string }): Promise<ApiResult<UserProfile>> => {
    const response = await apiService.patch<ApiResult<UserProfile>>("/auth/me", data);
    return response.data;
  },
  uploadAvatar: async (file: File): Promise<ApiResult<UserProfile>> => {
    const body = new FormData();
    body.append("file", file);
    const response = await apiService.upload<ApiResult<UserProfile>>("/auth/me/avatar", body);
    return response.data;
  },
  removeAvatar: async (): Promise<ApiResult<UserProfile>> => {
    const response = await apiService.delete<ApiResult<UserProfile>>("/auth/me/avatar");
    return response.data;
  },
  /** The session as the app reads it, from the Firebase account. */
  me: async (_signal?: AbortSignal): Promise<CurrentUser> => {
    const { firebaseAuth } = await import("@/lib/firebase/client");
    const auth = firebaseAuth();
    await auth.authStateReady();
    if (!auth.currentUser) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
    return toCurrentUser(auth.currentUser);
  },
};
