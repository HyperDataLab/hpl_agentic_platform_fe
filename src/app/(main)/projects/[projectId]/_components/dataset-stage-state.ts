import type { DatasetVersionItem } from "@/lib/api/services/fetch-datasets";
import { isLocalVersion } from "@/lib/api/services/fetch-datasets";
import type { LocalNodeItem } from "@/lib/api/services/fetch-local-nodes";
import type { RunItem } from "@/lib/api/services/fetch-runs";
import { isActiveRun } from "@/lib/research-workspace";
import { RunStatus } from "@/types/enums";

import { charterPendingFor, stageOutcomePending } from "./dataset-review-state";

export type NodeReadiness =
  | { state: "ready" }
  | { state: "unknown_capabilities" }
  | { state: "blocked"; title: string; hint: string };

/** Whether the Dataset stage can start for this version. Platform data needs no node; a local version needs its node. */
export function nodeReadiness(
  version: Pick<DatasetVersionItem, "storage" | "runner_id"> | null,
  nodes: LocalNodeItem[] | undefined,
): NodeReadiness {
  if (!isLocalVersion(version)) return { state: "ready" };
  const node = nodes?.find((item) => item.id === version?.runner_id && !item.revoked);
  if (!node || !node.paired_node)
    return {
      state: "blocked",
      title: "No paired Local Node holds this version",
      hint: "Pair the computer that has the file in Local Nodes, then run the stage.",
    };
  if (node.approval === "pending")
    return {
      state: "blocked",
      title: "This Local Node waits for approval",
      hint: "A Project Manager must approve it before it gets jobs.",
    };
  if (!node.online)
    return {
      state: "blocked",
      title: "The Local Node is offline",
      hint: "Open the Local Node app on that computer; the stage can start once it reconnects.",
    };
  if (!node.capabilities) return { state: "unknown_capabilities" };
  if (!node.capabilities.families.some((family) => family.family === "data_card"))
    return {
      state: "blocked",
      title: "This Local Node cannot build a data card yet",
      hint: "Update the Local Node app, then run the stage.",
    };
  return { state: "ready" };
}

export interface StageStep {
  id: string;
  label: string;
  detail: string;
  /** The researcher approves this step on the Local Node. */
  approve?: boolean;
}

const JOBS: Record<string, { label: string; detail: string }> = {
  data_card: { label: "Profile the variables", detail: "Type, measure, missing and distinct counts per variable." },
  table_quality: { label: "Check table quality", detail: "Duplicates and structure, as counts." },
  key_uniqueness: { label: "Check key uniqueness", detail: "Whether a column can identify a record." },
  table_fingerprint: { label: "Fingerprint the table", detail: "A hash that ties results to this version." },
};

/** The steps of the Dataset stage for a version. Local jobs come from what the node reports it can run. */
export function stageSteps(version: Pick<DatasetVersionItem, "storage">, node: LocalNodeItem | undefined): StageStep[] {
  const steps: StageStep[] = [];
  if (isLocalVersion(version)) {
    for (const family of node?.capabilities?.families ?? []) {
      const job = JOBS[family.family];
      if (job) steps.push({ id: family.family, ...job });
    }
    steps.push({
      id: "release",
      label: "Review the release",
      detail: "You approve what leaves the Local Node. Rows never do.",
      approve: true,
    });
  }
  steps.push(
    { id: "card", label: "Build the data card", detail: "The variable table the next stages read." },
    { id: "brief", label: "Write the dataset brief", detail: "Questions the data can answer." },
    {
      id: "snapshot",
      label: "Hand off the snapshot",
      detail: "Fixes the version for Hypothesis and Experiment design.",
    },
  );
  return steps;
}

export type StageLine = "idle" | "running" | "waiting_review" | "waiting_node" | "done" | "failed";

/** One word for where a run of the stage stands. */
export function stageLine(run: RunItem | undefined): StageLine {
  if (!run) return "idle";
  if (run.status === RunStatus.AwaitingReview) return "waiting_review";
  if (run.status === RunStatus.Paused) return "waiting_node";
  if (run.status === RunStatus.Completed) return "done";
  if (isActiveRun(run.status)) return "running";
  return "failed";
}

/** The run whose card the Data card tab shows: the newest that did not fail or stop. */
export function latestUsableRun(runs: RunItem[]): RunItem | undefined {
  return runs.find((run) => run.status !== RunStatus.Failed && run.status !== RunStatus.Stopped);
}

/** Percent of valid+missing, rounded; null when either count is withheld. */
export function missingPercent(summary: { n_valid: number | null; n_missing: number | null }): number | null {
  if (summary.n_valid == null || summary.n_missing == null) return null;
  const total = summary.n_valid + summary.n_missing;
  return total === 0 ? null : Math.round((summary.n_missing / total) * 100);
}

/**
 * What a run of the stage waits on, in words: a finished stage is waiting for you to accept it, not for an approval;
 * a failed or stopped run says so.
 */
export const CHARTER_WAIT = "Waiting for you to endorse the plan";

/** The one label every list and badge uses: the open stage-outcome question wins over the run's own status. */
export function stageStatusLabel(
  run: RunItem | undefined,
  consultations: { kind: string; authority?: string; decided_at?: string | null }[] = [],
) {
  if (charterPendingFor(run, consultations)) return CHARTER_WAIT;
  return stageOutcomePending(run, consultations) ? "Waiting for you to accept" : stageLabel(run);
}

export function stageLabel(run: RunItem | undefined): string | null {
  if (!run) return null;
  const stage = `${run.current_stage?.status ?? ""} ${run.current_stage?.phase ?? ""}`.toLowerCase();
  if (run.status === RunStatus.AwaitingReview && /completed|published/.test(stage)) return "Waiting for you to accept";
  if (run.status === RunStatus.Failed || run.status === RunStatus.BudgetExceeded) return "Failed";
  if (run.status === RunStatus.Stopped) return "Stopped";
  return null;
}
