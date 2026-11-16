import type { RunItem } from "@/lib/api/services/fetch-runs";

import { stageLabel, stageLine } from "./dataset-stage-state";

const TONES = {
  idle: "bg-muted text-muted-foreground",
  running: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  waiting_review: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  waiting_node: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  done: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  failed: "bg-muted text-muted-foreground",
} as const;

const LABELS = {
  idle: "Not run",
  running: "In progress",
  waiting_review: "Needs your approval",
  waiting_node: "Waiting for the Local Node",
  done: "Completed",
  failed: "Not finished",
} as const;

export function StageLineBadge({ run, label: forced }: { run: RunItem | undefined; label?: string }) {
  const line = stageLine(run);
  return (
    <span
      className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 font-medium text-xs ${TONES[line]}`}
    >
      {forced ?? stageLabel(run) ?? LABELS[line]}
    </span>
  );
}
