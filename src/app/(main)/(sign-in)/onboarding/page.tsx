import type { Metadata } from "next";

import { ClientRedirect } from "@/components/auth/client-redirect";

export const metadata: Metadata = { title: "Welcome · OpenAI Scientist" };

// The name comes from the Google account, so there is nothing to ask before the projects.
export default function OnboardingPage() {
  return <ClientRedirect to="/projects" />;
}
