"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { destination, useAuth } from "@/hooks/use-auth";
import { LAB_DOMAIN } from "@/lib/firebase/config";

import { GoogleOptionSkeleton } from "./auth-skeletons";
import { AuthStepHeading } from "./auth-step-heading";
import { GoogleButton } from "./social-auth/google-button";

/** Google sign-in, for verified accounts of the lab's domain only. Once signed in it goes on to the page asked for. */
export function GoogleSignInForm() {
  const router = useRouter();
  const { initialized, isAuthenticated } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated) router.replace(destination());
  }, [isAuthenticated, router]);

  return (
    <div className="flex flex-col gap-6">
      <AuthStepHeading title="Sign in" description={`Use your @${LAB_DOMAIN} Google account.`} />
      {!initialized || isAuthenticated ? (
        <GoogleOptionSkeleton label="Checking your sign-in" />
      ) : (
        <GoogleButton className="w-full" onError={setError} />
      )}
      {error && (
        <p role="alert" className="text-center text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
