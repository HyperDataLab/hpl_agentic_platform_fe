import type { Metadata } from "next";

import { GoogleSignInForm } from "../_components/google-sign-in-form";

export const metadata: Metadata = {
  title: "Sign in · OpenAI Scientist",
  description: "Sign in to OpenAI Scientist.",
  alternates: { canonical: "/auth/login" },
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-[350px] flex-col justify-center px-4 py-24 sm:px-0">
      <GoogleSignInForm />
    </div>
  );
}
