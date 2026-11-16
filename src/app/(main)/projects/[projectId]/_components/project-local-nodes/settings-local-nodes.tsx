"use client";

import { useState } from "react";

import { HardDrive } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useApproveLocalNode,
  useLocalNodeReleasesQuery,
  useLocalNodesQuery,
  useRevokeLocalNode,
} from "@/hooks/use-local-nodes-query";
import {
  describeRelease,
  type LocalNodeItem,
  type LocalNodeRelease,
  type LocalNodeState,
  localNodeState,
} from "@/lib/api/services/fetch-local-nodes";

import { timeAgo } from "../dataset-format";
import { SettingsGroup, SettingsHeading } from "../settings-panel";
import { NodeCapabilities } from "./node-capabilities";

const STATE_LABEL: Record<LocalNodeState, string> = { online: "Online", offline: "Offline", revoked: "Revoked" };
const STATE_VARIANT: Record<LocalNodeState, "secondary" | "outline" | "destructive"> = {
  online: "secondary",
  offline: "outline",
  revoked: "destructive",
};

export function StaleReleaseBadge({ release }: { release: Pick<LocalNodeRelease, "stale" | "superseded_by_version"> }) {
  if (release.stale !== true) return null;
  const description =
    release.superseded_by_version == null
      ? "A newer version of this dataset exists"
      : `A newer version v${release.superseded_by_version} of this dataset exists`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" tabIndex={0} aria-label={`Stale: ${description}`}>
          Stale
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{description}</TooltipContent>
    </Tooltip>
  );
}

function ReleaseLog({ projectId, node }: { projectId: string; node: LocalNodeItem }) {
  const releases = useLocalNodeReleasesQuery(projectId, node.id);
  const items = releases.data?.data ?? [];
  if (releases.isPending) return <Skeleton className="h-16 w-full" />;
  if (releases.isError)
    return (
      <Button variant="outline" size="sm" className="self-start" onClick={() => void releases.refetch()}>
        Reload release log
      </Button>
    );
  if (!items.length) return <p className="text-muted-foreground text-sm">Nothing has been released from this Node.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <caption className="sr-only">Signed releases from {node.name}</caption>
        <thead className="text-muted-foreground text-xs">
          <tr>
            <th className="py-1.5 pr-3 font-medium">#</th>
            <th className="py-1.5 pr-3 font-medium">Result</th>
            <th className="py-1.5 pr-3 font-medium">Release</th>
            <th className="py-1.5 pr-3 font-medium">Snapshot</th>
            <th className="py-1.5 font-medium">Received</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((release) => {
            const description = describeRelease(release);
            return (
              <tr key={release.release_id}>
                <td className="py-1.5 pr-3 tabular-nums">{release.sequence}</td>
                <td className="py-1.5 pr-3">
                  <div className="flex min-w-48 flex-col gap-1 break-words">
                    <p>{description.title}</p>
                    <StaleReleaseBadge release={release} />
                    {description.lines.length > 0 && (
                      <ul className="flex flex-col gap-1 text-muted-foreground text-xs">
                        {description.lines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </td>
                <td className="py-1.5 pr-3 font-mono text-xs" title={release.release_id}>
                  {release.release_id.slice(0, 12)}
                </td>
                <td className="py-1.5 pr-3 font-mono text-xs" title={release.snapshot_sha256}>
                  {release.snapshot_sha256.slice(0, 12)}
                </td>
                <td
                  className="py-1.5 text-muted-foreground"
                  title={new Date(release.received_at).toLocaleString("en-US")}
                >
                  {timeAgo(release.received_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="pt-2 text-muted-foreground text-xs">
        Results are signed by the Node. The Node's own release log holds the same entries.
      </p>
    </div>
  );
}

function connectionLabel(node: LocalNodeItem): string {
  if (node.connection === "signed_in") return `Signed in by ${node.owner_email ?? "a member"}`;
  if (node.connection === "pairing_code") return "Paired earlier";
  if (node.paired_node) return `Local Node ${node.node_version ?? ""}`.trim();
  return "Runner (token)";
}

function NodeRow({
  projectId,
  node,
  canWrite,
  canApprove,
  onRevoke,
}: {
  projectId: string;
  node: LocalNodeItem;
  canWrite: boolean;
  canApprove: boolean;
  onRevoke: () => void;
}) {
  const approve = useApproveLocalNode(projectId);
  const pending = node.approval === "pending" && !node.revoked;
  const [open, setOpen] = useState(false);
  const state = localNodeState(node);
  return (
    <li className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <HardDrive className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-medium text-sm">{node.name}</h3>
            <Badge variant={STATE_VARIANT[state]}>{STATE_LABEL[state]}</Badge>
            {pending && <Badge variant="outline">Waiting for approval</Badge>}
            {node.pending_reviews > 0 && (
              <Badge variant="outline">{node.pending_reviews} awaiting review on the Node</Badge>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            {connectionLabel(node)} · {node.last_seen_at ? `seen ${timeAgo(node.last_seen_at)}` : "never connected"} ·{" "}
            {node.release_count} {node.release_count === 1 ? "release" : "releases"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {pending && canApprove && (
            <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(node.id)}>
              Approve
            </Button>
          )}
          {node.paired_node && (
            <Button variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
              {open ? "Hide release log" : "Release log"}
            </Button>
          )}
          {canWrite && !node.revoked && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={onRevoke}>
              Revoke
            </Button>
          )}
        </div>
      </div>
      <NodeCapabilities capabilities={node.capabilities} />
      {open && <ReleaseLog projectId={projectId} node={node} />}
    </li>
  );
}

export function SettingsLocalNodes({
  projectId,
  readOnly,
  canApprove,
}: {
  projectId: string;
  readOnly: boolean;
  /** Project Managers approve a Researcher's computer. */
  canApprove: boolean;
}) {
  const list = useLocalNodesQuery(projectId);
  const revoke = useRevokeLocalNode(projectId);
  const [revoking, setRevoking] = useState<LocalNodeItem | null>(null);
  const nodes = list.data?.data ?? [];
  const canWrite = !readOnly;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <SettingsHeading title="Local Nodes" />
      <p className="max-w-prose text-muted-foreground text-sm">
        A Local Node keeps a dataset on a researcher's computer. The project sees its name, size and fingerprint, sends
        analysis jobs to it, and receives only aggregate results that pass the Node's release checks. Rows are never
        uploaded, previewed or downloaded.
      </p>
      <p className="max-w-prose text-muted-foreground text-sm">
        To connect a computer, open Local Node there and sign in with Logos.
      </p>
      {list.isPending && <Skeleton className="h-24 w-full" />}
      {list.isError && (
        <Button variant="outline" className="self-start" onClick={() => void list.refetch()}>
          Reload Local Nodes
        </Button>
      )}
      {!list.isPending && !list.isError && (
        <SettingsGroup title={`Connected computers · ${nodes.length}`}>
          {nodes.length ? (
            <ul className="divide-y">
              {nodes.map((node) => (
                <NodeRow
                  key={node.id}
                  projectId={projectId}
                  node={node}
                  canWrite={canWrite}
                  canApprove={canApprove && canWrite}
                  onRevoke={() => setRevoking(node)}
                />
              ))}
            </ul>
          ) : (
            <p className="p-4 text-muted-foreground text-sm sm:p-5">No computer is connected yet.</p>
          )}
        </SettingsGroup>
      )}
      {revoking && (
        <ConfirmDialog
          open
          destructive
          title={`Revoke "${revoking.name}"?`}
          description="The Node stops receiving jobs at once. Datasets it registered stay listed, and runs that need them wait until another Node holds the data. Released results stay readable."
          confirmLabel="Revoke"
          disabled={revoke.isPending}
          onOpenChange={(open) => {
            if (!open && !revoke.isPending) setRevoking(null);
          }}
          onConfirm={() => revoke.mutate(revoking.id, { onSuccess: () => setRevoking(null) })}
        />
      )}
    </div>
  );
}
