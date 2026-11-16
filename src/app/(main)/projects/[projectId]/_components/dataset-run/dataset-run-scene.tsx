"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";

import { cn } from "cn";
import { ArrowRight, Check, FileSpreadsheet, Flag, HardDrive, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { DataCardVariable } from "@/lib/api/services/fetch-dataset-runs";
import type { DatasetVersionItem } from "@/lib/api/services/fetch-datasets";
import type { LocalNodeItem } from "@/lib/api/services/fetch-local-nodes";
import type { RunItem } from "@/lib/api/services/fetch-runs";
import type { RunDisplayStatus } from "@/lib/run-stream/selectors";

import { useDatasetOutputs } from "../dataset-stage-hooks";
import { AnimatedNumber } from "../run-studio/animated-number";
import { AgentAvatar, AgentCursor } from "../run-studio/run-bits";
import { compactNumber } from "../run-studio/run-stats";
import { Pane, Placeholder } from "../run-studio/scenes/scene-ui";
import { activeAgent, type DatasetRunModel, type StepView } from "./dataset-run-model";
import { StepVisual, splitClause } from "./dataset-run-visuals";

/** Seconds the long computation has run: the engine's last count plus the time since it arrived. */
export function useElapsed(progress: DatasetRunModel["progress"]) {
  const [, setTick] = useState(0);
  const seen = useRef({ progress, at: Date.now() });
  if (seen.current.progress !== progress) seen.current = { progress, at: Date.now() };
  useEffect(() => {
    if (!progress) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [progress]);
  return progress ? progress.seconds + Math.floor((Date.now() - seen.current.at) / 1000) : null;
}

interface Tone {
  label: string;
  chip: string;
  dot: string;
}

/** How a step reads on screen: its colour follows todo, now, then the item's own result. */
export function toneOf(step: StepView): Tone {
  if (step.state === "done")
    return { label: "Passed", chip: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" };
  if (step.state === "asking")
    return { label: "Needs you", chip: "bg-amber-500/15 text-amber-800 dark:text-amber-300", dot: "bg-amber-500" };
  if (step.state === "now")
    return {
      label: step.item === "red" ? "Fixing" : "Working",
      chip: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
      dot: "bg-sky-500",
    };
  if (step.needsYou)
    return { label: "Waits for you", chip: "bg-amber-500/15 text-amber-800 dark:text-amber-300", dot: "bg-amber-500" };
  if (step.item === "red")
    return { label: "Open", chip: "bg-rose-500/12 text-rose-700 dark:text-rose-300", dot: "bg-rose-500" };
  return { label: "Waiting", chip: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/40" };
}

function Chip({ tone }: { tone: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full px-2 font-medium text-[11px]",
        tone.chip,
      )}
    >
      <span className={cn("size-1.5 rounded-full", tone.dot)} />
      {tone.label}
    </span>
  );
}

/** Column names a reason points at: the lists after a colon in its clauses. */
export function columnsIn(reason: string): string[] {
  return reason.split(/;\s*/).flatMap((clause) => splitClause(clause).columns);
}

/** The step the stage is on, large: what code found, what the steward does about it, and what it waits for. */
function FocusStep({
  step,
  model,
  live,
  current,
  version,
  variables,
  node,
}: {
  step: StepView;
  model: DatasetRunModel;
  live: boolean;
  current: boolean;
  version: DatasetVersionItem | undefined;
  variables: DataCardVariable[] | undefined;
  node: LocalNodeItem | undefined;
}) {
  const elapsed = useElapsed(current ? model.progress : null);
  const tone = toneOf(step);
  const working = live && current && step.state === "now";
  return (
    <Pane
      title={
        <span className="flex items-center gap-2.5">
          {working ? (
            <Spinner className="size-4 text-sky-500" />
          ) : (
            <span className={cn("size-2.5 rounded-full", tone.dot)} />
          )}
          {step.title}
        </span>
      }
      aside={<Chip tone={tone} />}
    >
      <p className="text-muted-foreground text-sm">{step.explain}</p>
      <div className="mt-3 grid gap-3 text-sm">
        <StepVisual step={step} model={model} version={version} variables={variables} node={node} />
        {step.needsYou && step.state !== "done" && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-amber-800 text-xs dark:text-amber-300">
            This waits for you: only you can say which columns answer your question and what the sources are.
          </p>
        )}
        {model.progress && current && (
          <div
            role="status"
            data-cursor="progress"
            className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-3 py-2"
          >
            <Spinner className="size-4" />
            <span className="min-w-0 flex-1 truncate">{model.progress.text.replace(/:\s*\d+ s( so far)?$/, "")}</span>
            <span className="font-mono text-muted-foreground text-xs tabular-nums">
              <AnimatedNumber value={elapsed ?? model.progress.seconds} /> s so far
            </span>
            <AgentAvatar agent="code" size="sm" />
          </div>
        )}
        <p className="flex flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
          <span className="font-mono">{step.key}</span>·
          {step.tokens ? (
            <span className="tabular-nums">
              <AnimatedNumber value={step.tokens} /> tokens · AI
            </span>
          ) : (
            <span>Code check · no AI</span>
          )}
        </p>
      </div>
    </Pane>
  );
}

/** The steps as one line each; click one to look at it in the scene. */
function Checklist({
  steps,
  shownKey,
  onView,
}: {
  steps: StepView[];
  shownKey: string | undefined;
  onView(key: string): void;
}) {
  return (
    <ul aria-label="All checks" className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      {steps.map((step) => {
        const tone = toneOf(step);
        const quiet = step.state === "todo" && !step.needsYou && step.item !== "red";
        return (
          <motion.li
            key={step.key}
            data-cursor={`item:${step.key}`}
            layout="position"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <button
              type="button"
              onClick={() => onView(step.key)}
              aria-current={step.key === shownKey ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50",
                step.key === shownKey && "bg-muted/60",
                quiet && "text-muted-foreground",
              )}
            >
              <span className="grid size-4 shrink-0 place-items-center">
                {step.state === "done" ? (
                  <Check className="size-3.5 text-emerald-600" strokeWidth={3} />
                ) : step.state === "asking" || step.needsYou ? (
                  <Flag className="size-3.5 text-amber-600" />
                ) : (
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      tone.dot,
                      step.state === "now" && "animate-pulse motion-reduce:animate-none",
                    )}
                  />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate">{step.title}</span>
              <Chip tone={tone} />
            </button>
          </motion.li>
        );
      })}
    </ul>
  );
}

/** The scene of the Dataset stage: the step it is on, the checks around it, and the review. */
export function DatasetRunScene({
  steps,
  model,
  dataset,
  version,
  local,
  focusKey,
  live,
  onView,
  variables,
  node,
}: {
  steps: StepView[];
  model: DatasetRunModel;
  dataset: { name: string };
  version: DatasetVersionItem | undefined;
  local: boolean;
  focusKey: string | null;
  live: boolean;
  onView(key: string | null): void;
  variables?: DataCardVariable[];
  node?: LocalNodeItem;
}) {
  const items = steps.filter((s) => s.gate !== true || s.key === "release");
  const done = steps.filter((s) => s.state === "done").length;
  const current = steps.find((s) => s.state === "now" || s.state === "asking");
  const shown = steps.find((s) => s.key === focusKey) ?? current;
  const started = Object.keys(model.items).length > 0 || model.releaseWait;
  const scene = useRef<HTMLDivElement>(null);
  const agent = live ? activeAgent(model, false) : null;
  // The pointer follows the newest event; an item that is not listed falls back to the step in progress.
  const wanted = model.cursor?.startsWith("item:") ? model.cursor.slice(5) : null;
  const onScreen = wanted && items.some((s) => s.key === wanted) ? wanted : current?.key;
  const firstColumn = onScreen === shown?.key ? columnsIn(shown?.reason ?? "")[0] : undefined;
  let target: string | null = onScreen ? `item:${onScreen}` : null;
  if (firstColumn) target = `col:${firstColumn}`;
  if (model.cursor === "progress") target = "progress";
  return (
    <div ref={scene} className="relative flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-8 place-items-center rounded-lg bg-teal-500/12 text-teal-700 dark:text-teal-300">
          <FileSpreadsheet className="size-4" />
        </span>
        <div className="flex min-w-0 flex-wrap items-baseline gap-2.5">
          <span className="truncate font-mono font-semibold text-sm">{dataset.name}</span>
          {version && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-muted-foreground text-xs">
              v{version.version_number}
            </span>
          )}
          {local && (
            <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
              <HardDrive aria-hidden="true" className="size-3.5" /> Rows stay on the Local Node
            </span>
          )}
        </div>
        <dl className="ml-auto flex gap-6 text-right">
          <div>
            <dt className="text-[11px] text-muted-foreground">Rows</dt>
            <dd className="font-mono font-semibold text-sm tabular-nums">
              {version ? `${local ? "~" : ""}${version.row_count.toLocaleString("en-US")}` : "–"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground">Columns</dt>
            <dd className="font-mono font-semibold text-sm tabular-nums">{version?.column_names.length ?? "–"}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground">Checked</dt>
            <dd className="font-mono font-semibold text-sm tabular-nums">
              <AnimatedNumber value={done} />/{steps.length}
            </dd>
          </div>
        </dl>
      </div>

      {!started ? (
        <Pane title="What the steward settles" aside="Code checks each item; the steward repairs the red ones">
          <Placeholder icon={<Spinner className="size-4" />}>
            {model.progress ? model.progress.text : "Waiting for the first check from the engine."}
          </Placeholder>
        </Pane>
      ) : (
        <>
          {shown && (
            <div className="flex flex-col gap-1.5">
              {focusKey && shown !== current && (
                <Button variant="ghost" size="xs" className="w-fit" onClick={() => onView(null)}>
                  Back to the current step
                </Button>
              )}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={shown.key}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <FocusStep
                    step={shown}
                    model={model}
                    live={live}
                    current={shown === current}
                    version={version}
                    variables={variables}
                    node={node}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          )}
          <Checklist steps={items} shownKey={shown?.key} onView={onView} />
        </>
      )}

      <AgentCursor
        agent={agent === "steward" || agent === "reviewer" ? agent : null}
        container={scene}
        target={target}
        version={`${model.lastSeq}:${focusKey}`}
      />

      {model.review && (
        <Pane title="Independent review" aside={`Round ${model.review.round}`}>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <AgentAvatar agent="reviewer" size="md" />
            <span>
              <b className="font-mono tabular-nums">{model.review.findings}</b>{" "}
              {model.review.findings === 1 ? "finding" : "findings"} on the {model.review.object.replaceAll("_", " ")}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-medium text-xs",
                model.review.blocking
                  ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                  : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
              )}
            >
              {model.review.blocking ? `${model.review.blocking} block the hand-off` : "None block the hand-off"}
            </span>
          </div>
        </Pane>
      )}
    </div>
  );
}

/** After the run: what it published, where to read it, and who uses it next. */
export function DatasetRunEnd({
  projectId,
  datasetId,
  run,
  status,
}: {
  projectId: string;
  datasetId: string;
  run: RunItem;
  status: RunDisplayStatus;
}) {
  const outputs = useDatasetOutputs(projectId, status === "completed" ? run : undefined);
  const card = outputs.data?.card;
  const questions = outputs.data?.brief?.questions.length ?? 0;
  if (status !== "completed") return null;
  return (
    <Pane
      title="Dataset stage accepted · Hypothesis next"
      aside={<ShieldCheck className="size-4" aria-hidden="true" />}
    >
      <p className="text-sm">
        {card
          ? `${card.title}: ${card.n_rows.toLocaleString("en-US")} rows, ${card.n_columns} variables${questions ? `, ${questions} ${questions === 1 ? "question" : "questions"} in the brief` : ""}.`
          : "The data card and the brief are published."}
      </p>
      <p className="mt-1 text-muted-foreground text-sm">
        Used by Hypothesis and Experiment design. They read the card and the brief, never the rows.
      </p>
      <Button className="mt-3" size="sm" asChild>
        <Link href={`/projects/${projectId}/datasets/${datasetId}?view=card&run=${run.id}`}>
          Open the Data card
          <ArrowRight data-icon="inline-end" />
        </Link>
      </Button>
    </Pane>
  );
}
