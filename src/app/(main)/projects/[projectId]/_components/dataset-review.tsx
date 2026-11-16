"use client";

import Link from "next/link";

import { cn } from "cn";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { MotionConfig } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DatasetItem, DatasetVersionItem } from "@/lib/api/services/fetch-datasets";
import { type RunItem, runProblem } from "@/lib/api/services/fetch-runs";

import { timeAgo } from "./dataset-format";
import {
  charterPendingFor,
  groupIssues,
  privacyChips,
  privacyNotes,
  stageOutcomePending,
} from "./dataset-review-state";
import { IssueCards, PrivacyChips, ReadinessBar, RoleDiagram, VariableMatrix } from "./dataset-review-visuals";
import { StageLineBadge } from "./dataset-stage-badge";
import { useDatasetOutputs, useRunConsultations } from "./dataset-stage-hooks";
import { CHARTER_WAIT, stageLine, stageStatusLabel } from "./dataset-stage-state";

function Section({
  title,
  hint,
  aside,
  children,
}: {
  title: string;
  hint?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="h-full rounded-xl border bg-card p-4">
      <header className="mb-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="font-medium text-sm">{title}</h3>
          {aside && <span className="ml-auto text-muted-foreground text-xs">{aside}</span>}
        </div>
        {hint && <p className="mt-0.5 text-muted-foreground text-xs">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

/** One run of the version, labelled the same way as the status block above it. */
function RunRow({ run, projectId, href }: { run: RunItem; projectId: string; href: string }) {
  const label = stageStatusLabel(run, useRunConsultations(projectId, run));
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm first:pt-0 last:pb-0">
      <span className="font-mono">{run.label ?? run.id.slice(0, 8)}</span>
      <span className="text-muted-foreground text-xs">{timeAgo(run.created_at)}</span>
      <StageLineBadge run={run} label={label ?? undefined} />
      <Button asChild variant="ghost" size="xs" className="ml-auto">
        <Link href={href}>Open the run</Link>
      </Button>
    </li>
  );
}

/** The Dataset stage and its data card as a dashboard: readiness first, then what each variable looks like. */
export function DatasetReview({
  projectId,
  dataset,
  version,
  runs,
  openRunId,
}: {
  projectId: string;
  dataset: DatasetItem;
  version: DatasetVersionItem;
  runs: RunItem[];
  openRunId: string | null;
}) {
  const run = runs.find((r) => r.id === openRunId) ?? runs.find((r) => stageLine(r) !== "failed") ?? runs[0];
  const line = stageLine(run);
  const outputs = useDatasetOutputs(projectId, run);
  const list = useRunConsultations(projectId, run);
  const planWait = charterPendingFor(run, list);
  const card = outputs.data?.card;
  const brief = outputs.data?.brief;
  const variables = card?.variables ?? version.local_card?.variables;
  // The finished stage asks to be accepted: whatever the badge says, the button follows the open question.
  const accepting = stageOutcomePending(run, list);
  const note = list.find((c) => c.kind === "stage_outcome" && c.result?.decision?.note)?.result?.decision?.note;
  const question = run ? runProblem(run) : null;
  const runHref = (id: string) => `/projects/${projectId}/datasets/${dataset.id}/runs/${id}`;
  const lines = [
    ...new Set([...(card?.caveats ?? []), ...(card?.gaps ?? []), ...(version.local_card?.report.gaps ?? [])]),
  ];
  const { kept } = privacyNotes(lines);
  const groups = variables ? groupIssues(variables, lines) : [];
  const chips = variables ? privacyChips(variables, lines) : [];
  const rows = card?.n_rows ?? version.local_card?.n_rows ?? version.row_count;

  const headline = !run
    ? "The Dataset stage has not run for this version"
    : planWait
      ? "The PI's plan waits for you to endorse it"
      : accepting
        ? "The stage is finished and waits for you to accept it"
        : line === "running"
          ? "The stage is running"
          : line === "waiting_review"
            ? "The stage waits for your approval"
            : line === "waiting_node"
              ? "The stage waits for the Local Node"
              : line === "done"
                ? "The stage is accepted"
                : "The stage did not finish";

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-4">
        <section aria-label="Readiness" className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="font-medium text-sm">{headline}</p>
            {run && (
              <StageLineBadge
                run={run}
                label={planWait ? CHARTER_WAIT : accepting ? "Waiting for you to accept" : undefined}
              />
            )}
          </div>
          {variables ? (
            <div className="mt-3">
              <ReadinessBar variables={variables} />
            </div>
          ) : (
            <p className="mt-2 text-muted-foreground text-sm">
              {run ? "No data card is published yet." : "Run the stage to get a data card."}
            </p>
          )}
          {run && (
            <dl className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted-foreground">Your question</dt>
              <dd>{question ?? "None was set for this run."}</dd>
              <dt className="text-muted-foreground">Stage verdict</dt>
              <dd>{note ?? "The stage gave no written verdict on whether the data fits a question."}</dd>
            </dl>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {run && (
              <Button asChild variant="outline">
                <Link href={runHref(run.id)}>Open the run</Link>
              </Button>
            )}
            {run && (
              <span className="text-muted-foreground text-xs">
                {run.label ?? run.id.slice(0, 8)} · started {timeAgo(run.created_at)}
              </span>
            )}
          </div>
          {run && accepting && !outputs.isPending && (
            <p className="mt-3 text-muted-foreground text-sm">
              This historical Dataset stage is waiting for its recorded outcome.
            </p>
          )}
        </section>

        {run && outputs.isPending && <Skeleton className="h-40 w-full" aria-label="Loading the data card" />}

        {variables && (
          <Section
            title="Variables"
            aside={`${variables.length} in ${card ? "the data card" : "the Local Node's card"}`}
          >
            <div className="mb-4">
              <RoleDiagram variables={variables} />
            </div>
            <VariableMatrix variables={variables} rows={rows} />
          </Section>
        )}

        {(run || variables) && (
          <div className="grid items-stretch gap-4 lg:grid-cols-2">
            <Section title="What needs a look" hint="Gaps and risks in the data, worst first. Open one for details.">
              {groups.length ? (
                <IssueCards groups={groups} />
              ) : (
                <p className="text-muted-foreground text-sm">The card flags nothing to look at.</p>
              )}
            </Section>

            <Section title="Privacy" hint="What the Local Node hid or rounded before sending.">
              {chips.length > 0 ? (
                <PrivacyChips chips={chips} />
              ) : (
                <p className="text-muted-foreground text-sm">The card reports no privacy rules.</p>
              )}
              {kept.length > 0 && (
                <details className="group mt-3 text-sm">
                  <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    <ChevronRight
                      className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                    What the Local Node did not compute · {kept.length}
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-9 text-muted-foreground">
                    {kept.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </details>
              )}
            </Section>

            <Section title="Questions this data can answer" hint="Research questions the stage found this data fits.">
              {brief?.questions.length ? (
                <ol className="space-y-2">
                  {brief.questions.map((q) => (
                    <li
                      key={q.id}
                      className={cn(
                        "rounded-md border p-2.5 text-sm",
                        brief.chosen?.question_id === q.id && "border-foreground",
                      )}
                    >
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-muted-foreground text-xs">{q.id}</span>
                        {brief.chosen?.question_id === q.id && <Badge variant="secondary">Chosen</Badge>}
                      </p>
                      <p className="mt-1">{q.text}</p>
                      <p className="mt-1 text-muted-foreground text-xs">Uses {q.variables.join(", ")}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {card ? "The stage published no questions. " : "Nothing is published yet. "}
                  {card &&
                    (question
                      ? "Start a research run with this dataset to continue into the research stages."
                      : "This run had no question of yours to work from. Start a research run with this dataset and add your question.")}
                </p>
              )}
            </Section>

            <Section title="Runs of this version" hint="Each time the Dataset stage ran on this version.">
              {runs.length ? (
                <ul className="divide-y">
                  {runs.map((r) => (
                    <RunRow key={r.id} run={r} projectId={projectId} href={runHref(r.id)} />
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">The stage has not run on this version.</p>
              )}
            </Section>
          </div>
        )}

        {run && !outputs.isPending && !variables && line !== "running" && (
          <p className="flex items-center gap-2 text-muted-foreground text-sm">
            <TriangleAlert className="size-4" /> No data card is published for this run.
          </p>
        )}
      </div>
    </MotionConfig>
  );
}
