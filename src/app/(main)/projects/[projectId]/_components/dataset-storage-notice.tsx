"use client";

import Link from "next/link";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function DatasetStorageNotice({ projectId }: { projectId: string }) {
  return (
    <section aria-label="Dataset storage" className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="font-medium">Add data to this project</h2>
        <p className="text-muted-foreground text-sm">
          Upload a file or import from a connection to store a copy on the Platform.
        </p>
      </div>
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            Must the rows stay on your computer?
            <ChevronDown data-icon="inline-end" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="max-w-prose pt-2 text-muted-foreground text-sm">
          Use the Local Node desktop app instead: choose Sign in with Logos, connect this project (a Project Manager
          approves a Researcher's computer in{" "}
          <Link href={`/projects/${projectId}/settings?tab=local-nodes`} className="underline underline-offset-4">
            Settings › Local Nodes
          </Link>
          ), then register the file. Only its name, size, fingerprint and row count reach the Platform. Analyses run on
          your computer and only aggregate results that pass its release checks are shared. Do not upload or import
          files that must remain on your computer.
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
