"use client";

import { useEffect, useRef } from "react";

import { cn } from "cn";
import { Check, Clock, Flag } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RunDisplayStatus } from "@/lib/run-stream/selectors";

import { RunFailureMessage } from "../run-studio/local-node-status";
import { AgentAvatar, Caret, TypedLine, WorkOrb } from "../run-studio/run-bits";
import { AGENTS } from "../run-studio/run-meta";
import {
  activeAgent,
  charterPending,
  type DatasetAgent,
  type DatasetRunModel,
  nextStopFor,
  outcomePending,
  RELEASE_WAIT,
  type StepView,
} from "./dataset-run-model";
import { useElapsed } from "./dataset-run-scene";

const TEAM = ["steward", "reviewer"] as const;

export interface AsideProps {
  model: DatasetRunModel;
  steps: StepView[];
  status: RunDisplayStatus;
  local: boolean;
  /** Type out narration that arrives as whole lines. */
  typing?: boolean;
}

const nameOf = (actor: DatasetAgent) => (actor === "you" ? "You" : AGENTS[actor].name);
const isEnded = (status: RunDisplayStatus) => status === "completed" || status === "failed" || status === "stopped";

/** The agents of this stage, the one working now lit up. */
function Team({ active }: { active: DatasetAgent | null }) {
  return (
    <div className="flex items-center gap-px overflow-hidden border-b px-3 py-3">
      {TEAM.map((role) => {
        const on = role === active;
        const agent = AGENTS[role];
        return (
          <motion.span
            key={role}
            layout
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className={cn(
              "inline-flex shrink-0 items-center rounded-full p-0.5",
              on && cn(agent.soft.split(" ")[0], "min-w-0 shrink gap-1.5 pr-2"),
            )}
          >
            <span className="relative">
              <AgentAvatar
                agent={role}
                size="sm"
                className={cn("size-6 transition-[opacity,filter] duration-300", !on && "opacity-50 saturate-[.3]")}
              />
              {on && (
                <span
                  className={cn(
                    "absolute -inset-[3px] animate-ping rounded-full opacity-40 ring-[1.5px] ring-current motion-reduce:animate-none",
                    agent.text,
                  )}
                />
              )}
            </span>
            <AnimatePresence>
              {on && (
                <motion.span
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className={cn("min-w-0 truncate font-semibold text-xs", agent.text)}
                >
                  {agent.name}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.span>
        );
      })}
      <span className="ml-auto whitespace-nowrap pl-2 text-[11px] text-muted-foreground">Code checks every item</span>
    </div>
  );
}

export function DatasetNowCard({
  model,
  steps,
  status,
  compact,
  typing = false,
}: Pick<AsideProps, "model" | "steps" | "status" | "typing"> & { compact?: boolean }) {
  const current = steps.find((s) => s.state === "now" || s.state === "asking");
  const index = current ? steps.indexOf(current) : -1;
  const speaker = isEnded(status) ? null : (model.message?.actor ?? current?.actor ?? null);
  const moving = status === "running" || status === "waiting";
  const done = steps.filter((s) => s.state === "done").length;
  const elapsed = useElapsed(model.progress);

  if (status === "completed")
    return (
      <div className="flex flex-col gap-2 rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
        <span className="text-muted-foreground text-xs">Finished</span>
        <h3 className="font-semibold text-[15px]">Dataset stage complete</h3>
        <p className="text-muted-foreground text-sm">
          The data card and the brief are ready. Hypothesis and Experiment design start from them.
        </p>
      </div>
    );
  if (status === "failed" || status === "stopped")
    return (
      <div className="flex flex-col gap-2 rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
        <span className="text-muted-foreground text-xs">Stopped</span>
        <h3 className="font-semibold text-[15px]">
          {model.failure?.code === "LOCAL_NODE_CAPABILITY" ? "Local Node update needed" : "The stage stopped"}
        </h3>
        <p className="text-muted-foreground text-sm">
          {status === "stopped" ? (
            "You stopped this run. What finished stays."
          ) : (
            <RunFailureMessage message={model.failure?.message} code={model.failure?.code} />
          )}
        </p>
      </div>
    );

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-3.5 shadow-xs ring-1 ring-foreground/10">
      <div className="flex justify-between gap-2 text-muted-foreground text-xs">
        <b className="font-medium text-foreground">Dataset stage</b>
        <span>{current ? `Step ${index + 1} of ${steps.length}` : `${done} of ${steps.length} done`}</span>
      </div>
      <div className={cn("grid items-start gap-x-3", moving && "grid-cols-[auto_minmax(0,1fr)]")}>
        {moving && <WorkOrb step={current?.key} waiting={status === "waiting"} size={32} className="mt-0.5" />}
        <div className="min-w-0">
          <motion.h3
            key={current?.key ?? "start"}
            title={current?.explain}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="font-semibold text-[15px] tracking-tight"
          >
            {current?.title ?? "Getting the stage ready"}
          </motion.h3>
          <p className="mt-1 min-h-5 text-sm leading-relaxed">
            {model.message ? (
              <>
                {model.message.text === RELEASE_WAIT && (
                  <Clock aria-hidden="true" className="mr-1.5 inline size-4 align-text-bottom text-muted-foreground" />
                )}
                <TypedLine text={model.message.text} typing={typing} />
                {status === "running" && <Caret />}
              </>
            ) : (
              !compact && <span className="text-muted-foreground">{current?.explain}</span>
            )}
          </p>
          {speaker && (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
              <span
                className={cn("size-1.5 rounded-full", speaker === "you" ? "bg-amber-500" : AGENTS[speaker].solid)}
              />
              <span className={cn("font-medium", speaker === "you" ? "text-amber-700" : AGENTS[speaker].text)}>
                {speaker === "code" ? "Code check · no AI" : nameOf(speaker)}
              </span>
              {model.progress && elapsed !== null && <span className="tabular-nums">· {elapsed} s so far</span>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Steps({ steps }: { steps: StepView[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="flex justify-between font-medium text-muted-foreground text-xs">
        <span>Steps in this stage</span>
        <span>
          {steps.filter((s) => s.state === "done").length} of {steps.length}
        </span>
      </p>
      <ol className="flex flex-col">
        {steps.map((step, i) => {
          const done = step.state === "done";
          const now = step.state === "now";
          const asking = step.state === "asking";
          return (
            <li
              key={step.key}
              className={cn(
                "relative grid grid-cols-[18px_1fr] gap-2.5 rounded-lg px-1 pb-3 last:pb-0",
                i < steps.length - 1 &&
                  cn(
                    "before:absolute before:top-[22px] before:bottom-1 before:left-[13px] before:w-px",
                    done ? "before:bg-foreground" : "before:bg-border",
                  ),
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-[18px] place-items-center rounded-full border bg-card transition-colors",
                  done && "border-foreground bg-foreground text-background",
                  now && "border-2 border-sky-500",
                  step.gate && !done && !asking && "border-amber-500 text-amber-600",
                  asking && "border-amber-500 bg-amber-500 text-white",
                )}
              >
                {done && <Check className="size-2.5" strokeWidth={3.5} />}
                {!done && step.gate && <Flag className="size-2.5" />}
                {now && (
                  <motion.span
                    className="size-1.5 rounded-full bg-sky-500"
                    animate={{ scale: [1, 0.6, 1] }}
                    transition={{ duration: 1.2, repeat: Number.POSITIVE_INFINITY }}
                  />
                )}
              </span>
              <span className="min-w-0">
                <b
                  className={cn(
                    "block font-medium text-[13px]",
                    !done && !now && !asking && "font-normal text-muted-foreground",
                  )}
                >
                  {step.title}
                </b>
                <small
                  className={cn(
                    "text-[11.5px]",
                    step.gate ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground",
                  )}
                >
                  {step.gate
                    ? done
                      ? "You decided"
                      : "You decide · the stage waits"
                    : AGENTS[step.actor === "you" ? "pi" : step.actor].name}
                </small>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function NextStop({ steps, status, local, model }: Pick<AsideProps, "steps" | "status" | "local" | "model">) {
  if (isEnded(status)) return null;
  const next = nextStopFor(steps, local);
  if ((model.releaseWait || model.gate || outcomePending(model) || charterPending(model)) && next)
    return (
      <div className="grid grid-cols-[auto_1fr] gap-2.5 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-xs">
        <span className="grid size-7 place-items-center rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-300">
          <Flag className="size-3.5" />
        </span>
        <span>
          <b className="block font-semibold text-[13px]">Waiting for you now</b>
          <span className="text-muted-foreground">{next.detail} Nothing runs until you answer.</span>
        </span>
      </div>
    );
  return (
    <div className="grid grid-cols-[auto_1fr] gap-2.5 rounded-xl border border-dashed p-3 text-xs">
      <span className="grid size-7 place-items-center rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300">
        <Flag className="size-3.5" />
      </span>
      <span>
        <b className="block font-semibold text-[13px]">{next?.title ?? "No more stops"}</b>
        <span className="text-muted-foreground">
          {next
            ? `${next.detail} Until then the agents work on their own; you can leave and come back.`
            : "The stage finishes on its own."}
        </span>
      </span>
    </div>
  );
}

function Activity({ model }: { model: DatasetRunModel }) {
  const end = useRef<HTMLDivElement>(null);
  const count = model.feed.length;
  useEffect(() => {
    if (count) end.current?.scrollIntoView({ block: "nearest" });
  }, [count]);
  if (!count) return <p className="text-muted-foreground text-xs">Nothing yet.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {model.feed.map((item) => (
        <motion.li
          key={`${item.seq}-${item.text}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-[auto_1fr] gap-2.5 text-xs"
        >
          {item.actor === "you" ? (
            <span className="grid size-5 place-items-center rounded-full bg-amber-500/20 font-semibold text-[8.5px] text-amber-800 dark:text-amber-300">
              You
            </span>
          ) : (
            <AgentAvatar agent={item.actor} size="sm" />
          )}
          <div className="text-muted-foreground">
            <b className={cn("font-semibold", item.actor === "you" ? "text-amber-800" : AGENTS[item.actor].text)}>
              {nameOf(item.actor)}
            </b>
            <span className="ml-1.5 font-mono text-[10.5px]">#{String(item.seq).padStart(4, "0")}</span>
            <p className="mt-px text-foreground leading-relaxed">{item.text}</p>
          </div>
        </motion.li>
      ))}
      <div ref={end} />
    </ol>
  );
}

export function DatasetRunAside({ model, steps, status, local, typing }: AsideProps) {
  const waiting =
    !isEnded(status) && (model.gate !== null || model.releaseWait || outcomePending(model) || charterPending(model));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Team active={isEnded(status) ? null : activeAgent(model, status === "paused")} />
      <Tabs defaultValue="now" className="min-h-0 flex-1 gap-0">
        <TabsList variant="line" className="w-full justify-start border-b px-3">
          <TabsTrigger value="now" className="flex-none">
            Now
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex-none">
            Activity
            <span className="rounded-full bg-muted px-1.5 font-mono font-semibold text-[10.5px] text-muted-foreground">
              {model.feed.length}
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="now" className="min-h-0 overflow-y-auto">
          <div className="flex flex-col gap-3.5 p-3.5">
            {waiting && <NextStop steps={steps} status={status} local={local} model={model} />}
            <DatasetNowCard model={model} steps={steps} status={status} typing={typing} />
            <Steps steps={steps} />
            {!waiting && <NextStop steps={steps} status={status} local={local} model={model} />}
          </div>
        </TabsContent>
        <TabsContent value="activity" className="min-h-0 overflow-y-auto p-3.5">
          <Activity model={model} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
