"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { ArrowLeft, PanelRight } from "lucide-react";
import { MotionConfig } from "motion/react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDatasetDetailQuery, useDatasetVersionsQuery } from "@/hooks/use-datasets-query";
import { useLocalNodesQuery } from "@/hooks/use-local-nodes-query";
import { isLocalVersion } from "@/lib/api/services/fetch-datasets";
import { runTitle } from "@/lib/api/services/fetch-runs";
import type { RunDisplayStatus } from "@/lib/run-stream/selectors";
import { RunStatus } from "@/types/enums";

import { useDatasetOutputs } from "../dataset-stage-hooks";
import { stageLine } from "../dataset-stage-state";
import { LocalNodeWaitBanner, SupersededDatasetBanner } from "../run-studio/local-node-status";
import { StatusPill } from "../run-studio/run-bits";
import { DatasetNowCard, DatasetRunAside } from "./dataset-run-aside";
import { DatasetOutcomeSheet, ReleaseCard } from "./dataset-run-gate";
import { outcomePending, stepViews } from "./dataset-run-model";
import { DatasetRunEnd, DatasetRunScene } from "./dataset-run-scene";
import { DatasetRunTrack } from "./dataset-run-track";
import { useDatasetRun } from "./use-dataset-run";

const STATUS = {
  idle: "running",
  running: "running",
  waiting_review: "waiting",
  waiting_node: "paused",
  done: "completed",
  failed: "failed",
} as const;

/** The Dataset stage as a run, in the same frame as a Research run: top bar, steps, a scene and the agents' column. */
export function DatasetRunView({
  projectId,
  datasetId,
  runId,
}: {
  projectId: string;
  datasetId: string;
  runId: string;
}) {
  const { run, model } = useDatasetRun(projectId, runId);
  const dataset = useDatasetDetailQuery(projectId, datasetId).data?.data;
  const versions = useDatasetVersionsQuery(projectId, datasetId).data?.data;
  const nodes = useLocalNodesQuery(projectId).data?.data;
  const [asideOpen, setAsideOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const version = versions?.find((v) => v.id === run?.dataset_version_id) ?? dataset?.latest_version ?? undefined;
  const local = isLocalVersion(version);
  const line = stageLine(run);
  const status: RunDisplayStatus = line === "failed" && run?.status === RunStatus.Stopped ? "stopped" : STATUS[line];
  const ended = status === "completed" || status === "failed" || status === "stopped";
  const outputs = useDatasetOutputs(projectId, status === "completed" ? run : undefined);
  const steps = useMemo(
    () => stepViews(model, { local, ended: status === "completed" ? "done" : ended ? "failed" : null }),
    [model, local, status, ended],
  );
  const label = run?.label ?? `RUN-${runId.slice(0, 4).toUpperCase()}`;
  const back = `/projects/${projectId}/datasets/${datasetId}`;
  // The wait for a node: paused because its runner is away, as Research runs say it.
  const nodeWait = line === "waiting_node" && (model.pauseReason ?? "runner_offline") === "runner_offline";
  // The release stop is the engine's wait for the Local Node app; the accept stop is the end-of-stage question.
  // The Platform keeps the run "running" while a Node holds a result for review; only the Node's count says so.
  const nodePending =
    nodes?.some((node) => node.pending_reviews > 0 && (!version?.runner_id || node.id === version.runner_id)) ?? false;
  // Only a Node that really holds a result for review is a release wait; a finished stage never is.
  const releaseWait = local && !model.gate && !model.published && line === "running" && nodePending;
  const shownModel = releaseWait && !model.releaseWait ? { ...model, releaseWait: true } : model;
  const shownSteps = useMemo(
    () => (releaseWait && !model.releaseWait ? stepViews(shownModel, { local, ended: null }) : steps),
    [releaseWait, model.releaseWait, shownModel, local, steps],
  );

  useEffect(() => {
    if (!focusKey) return;
    document.getElementById(`dataset-step-${focusKey}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusKey]);

  return (
    <MotionConfig reducedMotion="user">
      <section aria-label={`Dataset run ${label}`} className="fixed inset-0 z-50 flex flex-col bg-background">
        <header className="flex min-h-14 flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b px-3 py-2 md:flex-nowrap md:pr-4">
          <Button variant="ghost" size="sm" asChild title="Leave the run. It keeps going.">
            <Link href={back}>
              <ArrowLeft />
              {dataset?.name ?? "Dataset"}
            </Link>
          </Button>
          <Separator orientation="vertical" className="h-5 max-md:hidden" />
          <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
            <b className="whitespace-nowrap font-mono font-semibold text-sm">{label}</b>
            <span className="truncate text-muted-foreground text-sm max-md:hidden">
              {run ? (runTitle(run) ?? "Dataset stage") : ""}
            </span>
          </div>
          {run && <StatusPill status={status} />}
          <div className="flex items-center gap-2 max-md:w-full max-md:justify-between">
            <Button
              variant="ghost"
              size="icon-sm"
              className="max-lg:hidden"
              onClick={() => setAsideOpen((open) => !open)}
              aria-label="Show or hide the side panel"
            >
              <PanelRight />
            </Button>
          </div>
        </header>

        {!run ? (
          <div className="p-6">
            <Skeleton className="h-40 w-full" aria-label="Loading the run" />
          </div>
        ) : (
          <>
            <DatasetRunTrack
              steps={shownSteps}
              ended={ended}
              viewKey={focusKey}
              onView={setFocusKey}
              liveFill={Math.min(85, 30 + (model.progress?.seconds ?? 0))}
            />
            {nodeWait && <LocalNodeWaitBanner state={{ lifecycle: "paused", pauseReason: "runner_offline" }} />}
            <SupersededDatasetBanner
              state={{
                dataset_superseded: model.superseded ? true : undefined,
                superseded_by_version: model.superseded?.by,
              }}
            />
            <div className={`grid min-h-0 flex-1 ${asideOpen ? "lg:grid-cols-[minmax(0,1fr)_352px]" : "grid-cols-1"}`}>
              <div className="relative flex min-h-0 min-w-0 flex-col">
                <div className="border-b px-4 py-2.5 lg:hidden">
                  <DatasetNowCard model={shownModel} steps={shownSteps} status={status} compact typing />
                  <Button variant="ghost" size="xs" className="mt-1.5" onClick={() => setDetailsOpen(true)}>
                    Steps and activity
                  </Button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className="flex flex-col gap-4 px-4 pt-5 pb-24 md:px-8">
                    {shownModel.gate === null && !ended && shownModel.releaseWait && !model.published && (
                      <ReleaseCard />
                    )}
                    <DatasetRunScene
                      steps={shownSteps}
                      model={shownModel}
                      dataset={{ name: dataset?.name ?? "Dataset" }}
                      version={version}
                      local={local}
                      focusKey={focusKey}
                      live={status === "running"}
                      onView={setFocusKey}
                      variables={outputs.data?.card?.variables ?? version?.local_card?.variables}
                      node={nodes?.find((n) => n.id === version?.runner_id) ?? nodes?.[0]}
                    />
                    {outcomePending(model) && model.outcome && (
                      <DatasetOutcomeSheet outcome={model.outcome} projectId={projectId} runId={runId} />
                    )}
                    <DatasetRunEnd projectId={projectId} datasetId={datasetId} run={run} status={status} />
                  </div>
                </div>
              </div>
              {asideOpen && (
                <aside className="min-h-0 border-l bg-sidebar max-lg:hidden">
                  <DatasetRunAside model={shownModel} steps={shownSteps} status={status} local={local} typing />
                </aside>
              )}
            </div>
            <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
              <SheetContent side="bottom" className="h-[80vh] p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Steps and activity</SheetTitle>
                </SheetHeader>
                <DatasetRunAside model={shownModel} steps={shownSteps} status={status} local={local} typing />
              </SheetContent>
            </Sheet>
          </>
        )}
      </section>
    </MotionConfig>
  );
}
