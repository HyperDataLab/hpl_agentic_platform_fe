"use client";

import { Clock } from "lucide-react";

import { useApiQuery } from "@/hooks/use-api";
import { projectKeys } from "@/lib/api/query-keys";
import { datasetRunKeys, fetchDatasetRuns } from "@/lib/api/services/fetch-dataset-runs";
import { fetchRuns } from "@/lib/api/services/fetch-runs";

import { hasChosenQuestion } from "../dataset-review-state";
import { type DatasetRunModel, RELEASE_WAIT } from "./dataset-run-model";

/** The wait for a release on the Local Node, which is answered in that app, not here. */
export function ReleaseCard() {
  return (
    <section
      aria-label="Waiting for you"
      className="flex items-start gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3.5"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-300">
        <Clock className="size-4" />
      </span>
      <div className="min-w-0">
        <b className="block font-semibold text-sm">{RELEASE_WAIT.replace(/\.$/, "")}</b>
        <p className="text-muted-foreground text-xs">
          Open the Local Node app and go to Releases to review what would leave your computer. Rows never do.
        </p>
      </div>
    </section>
  );
}

/** Read a legacy Dataset run's outcome without offering stage rerun or acceptance actions. */
export function DatasetOutcomeSheet({
  outcome,
  projectId,
  runId,
}: {
  outcome: NonNullable<DatasetRunModel["outcome"]>;
  projectId: string;
  runId: string;
}) {
  const consultations = useApiQuery(projectKeys.run(projectId, runId).concat(["pi", "consultations"]), (signal) =>
    fetchRuns.getConsultations(projectId, runId, signal),
  );
  const outputs = useApiQuery(datasetRunKeys.outputs(projectId, runId), (signal) =>
    fetchDatasetRuns.outputs(projectId, runId, signal),
  );
  const note = [consultations.data?.data ?? []].flat().find((c) => c.id === outcome.consultationId)?.result
    ?.decision?.note;
  if (outputs.isPending || consultations.isPending) return null;
  const hasQuestion = hasChosenQuestion(outputs.data?.brief);
  return (
    <section aria-label="Historical Dataset stage outcome" className="rounded-xl border bg-card p-4 text-sm">
      <h2 className="font-semibold">Dataset stage outcome</h2>
      <p className="mt-2 text-muted-foreground">
        {hasQuestion
          ? `The PI recommended ${outcome.action ?? "accepting the data card"}${outcome.confidence === undefined ? "." : ` (${Math.round(outcome.confidence * 100)}% confidence).`}`
          : "This historical run has no chosen question and did not hand off to the research stages."}
      </p>
      {note && <p className="mt-2">{note}</p>}
      <p className="mt-2 text-muted-foreground">
        This run is kept for review. Start a research run to use this dataset again.
      </p>
    </section>
  );
}
