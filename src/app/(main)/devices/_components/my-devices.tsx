"use client";

import { useState } from "react";

import { HardDrive } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { fetchNodeDevices, type NodeDevice } from "@/lib/api/services/fetch-node-devices";

const KEY = ["users", "me", "node-devices"] as const;

function seen(device: NodeDevice) {
  if (!device.last_seen_at) return "never connected";
  return `last seen ${new Date(device.last_seen_at).toLocaleString("en-US")}`;
}

/** The computers signed in to this account with Logos Local Node, and removing one. */
export function MyDevices() {
  const list = useApiQuery(KEY, (signal) => fetchNodeDevices.list(signal), {
    refetchInterval: (state) => (state.state.error ? false : 30_000),
  });
  const revoke = useApiMutation((id: string) => fetchNodeDevices.revoke(id), [KEY]);
  const [removing, setRemoving] = useState<NodeDevice | null>(null);
  const devices = list.data?.data ?? [];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-xl">Your Local Nodes</h1>
        <p className="max-w-prose text-muted-foreground text-sm">
          Computers where you signed in with Logos Local Node. Each has its own device key. Removing one signs it out
          and ends its project connections; results it already released stay readable.
        </p>
      </div>
      {list.isPending && <Skeleton className="h-24 w-full" />}
      {list.isError && (
        <Button variant="outline" className="self-start" onClick={() => void list.refetch()}>
          Reload
        </Button>
      )}
      {!list.isPending && !list.isError && devices.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No computer yet. Install Logos Local Node and choose Sign in with Logos.
        </p>
      )}
      {devices.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {devices.map((device) => (
            <li key={device.id} className="flex min-w-0 flex-wrap items-center gap-3 p-4">
              <HardDrive className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-medium text-sm">{device.name}</h2>
                  {device.revoked ? (
                    <Badge variant="destructive">Removed</Badge>
                  ) : (
                    <Badge variant="secondary">Trusted</Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  {device.node_version} · {seen(device)} · {device.projects.length}{" "}
                  {device.projects.length === 1 ? "project" : "projects"}
                </p>
              </div>
              {!device.revoked && (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRemoving(device)}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {removing && (
        <ConfirmDialog
          open
          destructive
          title={`Remove "${removing.name}"?`}
          description="It is signed out at once and stops receiving jobs from every project. Sign in on it again to use it."
          confirmLabel="Remove"
          disabled={revoke.isPending}
          onOpenChange={(open) => {
            if (!open && !revoke.isPending) setRemoving(null);
          }}
          onConfirm={() => revoke.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
        />
      )}
    </main>
  );
}
