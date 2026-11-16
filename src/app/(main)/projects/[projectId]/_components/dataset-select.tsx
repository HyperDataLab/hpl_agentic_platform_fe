"use client";

import { useCallback, useEffect, useState } from "react";

import { HardDrive } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInfiniteDatasets, useInfiniteDatasetVersions } from "@/hooks/use-datasets-query";
import { useLocalNodesQuery } from "@/hooks/use-local-nodes-query";
import type { DatasetItem, DatasetVersionItem } from "@/lib/api/services/fetch-datasets";
import { isLocalVersion } from "@/lib/api/services/fetch-datasets";

const NONE = "none";
const MORE_PREFIX = "more:";

export function researchRunHref(projectId: string, datasetId: string, datasetVersionId: string) {
  const query = new URLSearchParams({ dataset_id: datasetId, dataset_version_id: datasetVersionId });
  return `/projects/${encodeURIComponent(projectId)}/experiments?${query}#start-run`;
}

type VersionGroupState = {
  versions: DatasetVersionItem[];
  loadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
};

function DatasetVersionsLoader({
  projectId,
  dataset,
  enabled,
  onLoaded,
}: {
  projectId: string;
  dataset: DatasetItem;
  enabled: boolean;
  onLoaded(datasetId: string, state: VersionGroupState): void;
}) {
  const query = useInfiniteDatasetVersions(projectId, dataset.id, { pageSize: 100, enabled });
  const loadMore = useCallback(() => void query.loadMore(), [query.loadMore]);
  useEffect(
    () =>
      onLoaded(dataset.id, {
        versions: query.versions,
        loadMore,
        hasMore: Boolean(query.hasNextPage),
        loadingMore: query.isFetchingNextPage,
      }),
    [dataset.id, loadMore, onLoaded, query.hasNextPage, query.isFetchingNextPage, query.versions],
  );
  return null;
}

export function DatasetVersionSelect({
  projectId,
  value,
  preloadDatasetId,
  onChange,
}: {
  projectId: string;
  value: string;
  preloadDatasetId?: string;
  onChange(value: string): void;
}) {
  const datasetsQuery = useInfiniteDatasets(projectId, { pageSize: 100 });
  const localNodes = useLocalNodesQuery(projectId);
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<Record<string, VersionGroupState>>({});
  const onLoaded = useCallback((datasetId: string, state: VersionGroupState) => {
    setGroups((current) => (current[datasetId] === state ? current : { ...current, [datasetId]: state }));
  }, []);
  const versions = Object.values(groups).flatMap((group) => group.versions);
  const chosenVersion = versions.find((version) => version.id === value);
  const chosenDataset = datasetsQuery.items.find((dataset) => dataset.id === chosenVersion?.dataset_id);
  const node = chosenVersion?.runner_id
    ? localNodes.data?.data.find((item) => item.id === chosenVersion.runner_id)
    : undefined;
  const waitForNode =
    isLocalVersion(chosenVersion) &&
    !localNodes.isPending &&
    !localNodes.isError &&
    (!node?.paired_node || !node.online);
  const selectedLabel = chosenVersion
    ? `${chosenDataset?.name ?? "Dataset"} · v${chosenVersion.version_number}`
    : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {datasetsQuery.items.map((dataset) => (
        <DatasetVersionsLoader
          key={dataset.id}
          projectId={projectId}
          dataset={dataset}
          enabled={open || dataset.id === preloadDatasetId}
          onLoaded={onLoaded}
        />
      ))}
      <Select
        open={open}
        onOpenChange={setOpen}
        value={value || NONE}
        onValueChange={(next) => {
          if (next === NONE) {
            onChange("");
            return;
          }
          if (next.startsWith(MORE_PREFIX)) {
            const key = next.slice(MORE_PREFIX.length);
            if (key === "datasets") void datasetsQuery.loadMore();
            else groups[key]?.loadMore();
            return;
          }
          if (next !== "empty") onChange(next);
        }}
      >
        <SelectTrigger className="w-full" aria-label="Dataset">
          <SelectValue placeholder="No dataset">{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent
          position="popper"
          className="max-h-72 w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]"
        >
          <SelectGroup>
            <SelectItem value={NONE}>No dataset</SelectItem>
          </SelectGroup>
          {datasetsQuery.items.map((dataset) => {
            const options = groups[dataset.id]?.versions ?? (dataset.latest_version ? [dataset.latest_version] : []);
            return (
              <SelectGroup key={dataset.id}>
                <SelectLabel>{dataset.name}</SelectLabel>
                {options.map((version) => (
                  <SelectItem key={version.id} value={version.id}>
                    {dataset.name} · v{version.version_number}
                    {isLocalVersion(version) ? " · Runs on your computer" : ""}
                  </SelectItem>
                ))}
                {groups[dataset.id]?.hasMore && (
                  <SelectItem value={`${MORE_PREFIX}${dataset.id}`}>
                    {groups[dataset.id].loadingMore ? "Loading older versions…" : "Load older versions"}
                  </SelectItem>
                )}
              </SelectGroup>
            );
          })}
          {datasetsQuery.hasNextPage && <SelectItem value={`${MORE_PREFIX}datasets`}>Load more datasets</SelectItem>}
          {!datasetsQuery.isPending && datasetsQuery.items.length === 0 && (
            <SelectGroup>
              <SelectItem value="empty" disabled>
                No datasets available
              </SelectItem>
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
      {chosenVersion && isLocalVersion(chosenVersion) && (
        <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <HardDrive aria-hidden="true" className="size-3.5" />
          Runs on your computer{node ? ` · ${node.name} · ${node.online ? "Online" : "Offline"}` : " · Local Node"}
        </p>
      )}
      {waitForNode && (
        <p className="text-amber-700 text-xs dark:text-amber-300">The run will wait for your Local Node.</p>
      )}
    </div>
  );
}
