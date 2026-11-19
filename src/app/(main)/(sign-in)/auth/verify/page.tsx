import type { Metadata } from "next";

import { ClientRedirect } from "@/components/auth/client-redirect";
import { LOGIN_PATH } from "@/lib/auth/auth-config";

export const metadata: Metadata = {
  title: "Sign in · OpenAI Scientist",
  robots: { index: false, follow: false },
};

// Sign-in links are gone: accounts sign in with Google. Old links land on the sign-in page.
export default function VerifySignInLinkPage() {
  return <ClientRedirect to={LOGIN_PATH} />;
}
