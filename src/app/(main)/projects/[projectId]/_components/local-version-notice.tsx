import { HardDrive } from "lucide-react";

import type { DatasetVersionItem } from "@/lib/api/services/fetch-datasets";

import { LocalDataCard } from "./local-data-card";

/** Shown instead of a preview: a Local Node version has metadata here and its rows on the Node. */
export function LocalVersionNotice({ version }: { version: DatasetVersionItem }) {
  if (version.storage === "local" && version.local_card) {
    return <LocalDataCard version={version} card={version.local_card} />;
  }

  return (
    <section
      aria-label={`Version ${version.version_number} stays on a Local Node`}
      className="flex min-w-0 items-start gap-3 rounded-lg border p-4"
    >
      <HardDrive className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1 text-sm">
        <p className="font-medium">Waiting for the Local Node to release a data card</p>
        <p className="max-w-prose text-muted-foreground">
          The Platform keeps its name, size, fingerprint and{" "}
          {version.disclosure === "strict" ? "rounded row count" : "row count"}. There is no preview or download.
          Research runs send their analyses to the Node, which returns only aggregate results that pass its release
          checks.
        </p>
        <p className="font-mono text-muted-foreground text-xs" title={version.sha256}>
          SHA-256 {version.sha256.slice(0, 16)}… · {version.disclosure === "strict" ? "Strict" : "Standard"} disclosure
        </p>
      </div>
    </section>
  );
}
