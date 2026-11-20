"use client";

import { AuthGate } from "@/components/auth/auth-gate";

import { TopBarShell } from "../../_components/top-bar-shell";
import { LlmSettingsForm } from "./llm-settings-form";

export function SettingsPage() {
  return (
    <AuthGate>
      {(user) => (
        <TopBarShell homeUrl="/projects" user={user}>
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h1 className="font-heading text-2xl">Language model</h1>
              <p className="text-muted-foreground text-sm">
                The endpoint, key and models every run in every project uses, saved in this browser.
              </p>
            </div>
            <LlmSettingsForm />
          </div>
        </TopBarShell>
      )}
    </AuthGate>
  );
}
