"use client";

import { useEffect, useRef } from "react";

import { cn } from "cn";
import { Flag } from "lucide-react";
import { motion } from "motion/react";

import type { StepView } from "./dataset-run-model";

/** The Dataset stage's steps as bars that fill as each one finishes, with a flag where the run stops for you. */
export function DatasetRunTrack({
  steps,
  ended,
  viewKey,
  onView,
  liveFill = 45,
}: {
  steps: StepView[];
  ended: boolean;
  viewKey: string | null;
  onView(key: string): void;
  /** Percent the step in progress shows as filled. */
  liveFill?: number;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const now = steps.find((s) => s.state === "now" || s.state === "asking")?.key;
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-track="${now}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [now]);
  return (
    <div ref={scroller} className="overflow-x-auto overflow-y-hidden border-b px-4 pt-3 pb-3.5 md:px-5">
      <ol aria-label="Steps of the Dataset stage" className="flex gap-1.5" style={{ minWidth: steps.length * 104 }}>
        {steps.map((step) => {
          const live = !ended && (step.state === "now" || step.state === "asking");
          const waiting = step.state === "asking";
          const viewing = step.key === viewKey;
          return (
            <li key={step.key} data-track={step.key} className="relative min-w-0 flex-1 basis-0">
              <button
                type="button"
                onClick={() => onView(step.key)}
                aria-current={live ? "step" : undefined}
                className="flex w-full flex-col gap-1.5 rounded py-0.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span
                  className={cn(
                    "truncate pr-3 font-medium text-xs transition-colors",
                    step.state === "done" || live || viewing ? "text-foreground" : "text-muted-foreground",
                    viewing && "font-semibold",
                  )}
                >
                  {step.short}
                </span>
                <span className="relative h-1 overflow-hidden rounded-full bg-muted">
                  <motion.i
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full",
                      waiting ? "bg-amber-500" : live ? "bg-sky-500" : "bg-foreground",
                    )}
                    initial={false}
                    animate={{ width: step.state === "done" ? "100%" : live ? `${liveFill}%` : "0%" }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  />
                  {live && !waiting && (
                    <motion.i
                      className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-sky-500/40 to-transparent"
                      animate={{ x: ["-100%", "300%"] }}
                      transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                    />
                  )}
                </span>
              </button>
              {step.gate && (
                <span
                  title="Stops for you here"
                  className={cn(
                    "absolute -right-2 bottom-[-5px] z-10 grid size-[18px] place-items-center rounded-full bg-background",
                    waiting
                      ? "bg-amber-500 text-white"
                      : step.state === "done"
                        ? "text-muted-foreground"
                        : "text-amber-500",
                  )}
                >
                  <Flag className="size-3" />
                  <span className="sr-only">You decide here</span>
                </span>
              )}
              {viewing && (
                <motion.span
                  layoutId="dataset-track-viewing"
                  className="absolute inset-x-0 right-3 -bottom-3.5 h-0.5 rounded-full bg-foreground"
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
