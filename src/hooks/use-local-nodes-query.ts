"use client";

import { projectKeys } from "@/lib/api/query-keys";
import { fetchLocalNodes } from "@/lib/api/services/fetch-local-nodes";

import { useApiMutation, useApiQuery } from "./use-api";

/** The project's Local Nodes; polled so online/offline follows the Node's heartbeat. */
export function useLocalNodesQuery(projectId: string) {
  return useApiQuery(projectKeys.localNodes(projectId), (signal) => fetchLocalNodes.list(projectId, signal), {
    enabled: Boolean(projectId),
    refetchInterval: (state) => (state.state.error ? false : 20_000),
  });
}

export function useLocalNodeReleasesQuery(projectId: string, runnerId: string | null) {
  return useApiQuery(
    projectKeys.localNodeReleases(projectId, runnerId ?? ""),
    (signal) => fetchLocalNodes.releases(projectId, runnerId ?? "", signal),
    { enabled: Boolean(projectId && runnerId) },
  );
}

export function useApproveLocalNode(projectId: string) {
  return useApiMutation(
    (runnerId: string) => fetchLocalNodes.approve(projectId, runnerId),
    [projectKeys.localNodes(projectId)],
  );
}

export function useRevokeLocalNode(projectId: string) {
  return useApiMutation(
    (runnerId: string) => fetchLocalNodes.revoke(projectId, runnerId),
    [projectKeys.localNodes(projectId), projectKeys.datasets(projectId)],
  );
}
