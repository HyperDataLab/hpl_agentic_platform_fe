import { describe, expect, it } from "vitest";

import real from "../../../../../../tests/screens/fixtures/dataset-run-real-card.json";
import {
  charterPendingFor,
  groupIssues,
  hasChosenQuestion,
  issuesOf,
  openRunOf,
  privacyChips,
  privacyNotes,
  readiness,
  roleKind,
  stageOutcomePending,
} from "./dataset-review-state";

const variable = (name: string, missing: number, flags: string[] = [], role = "input") => ({
  name,
  role,
  summary: { n_valid: 100 - missing, n_missing: missing },
  flags,
});

describe("issuesOf", () => {
  it("puts the worst first and says it in plain words", () => {
    const issues = issuesOf([
      variable("participant_id", 0, ["near_unique"], "none"),
      variable("self_study_sessions_week", 25),
      variable("score", 0, ["top_coded", "levels_withheld"]),
    ]);
    expect(issues[0]).toMatchObject({
      severity: "high",
      text: "self_study_sessions_week is missing 25% of its values.",
    });
    expect(issues.map((i) => i.text)).toContain(
      "participant_id is almost unique on each row, so it is a key, not a variable to analyse.",
    );
    expect(issues.find((i) => i.text.startsWith("The largest values of score"))?.hint).toContain("privacy");
    expect(issues.some((i) => i.text.includes("levels_withheld"))).toBe(false);
  });

  it("flags nothing for clean columns", () => {
    expect(issuesOf([variable("a", 1)])).toEqual([]);
  });
});

describe("privacyNotes", () => {
  it("turns the Local Node's not-computed lines into sentences and leaves other notes alone", () => {
    const { kept, other } = privacyNotes([
      "Not computed on the Local Node: text_variants (levels withheld)",
      "Counts are rounded down to 10.",
    ]);
    expect(kept).toEqual([
      "Spelling variants of text values are not computed here: the category values stay on your computer.",
    ]);
    expect(other).toEqual(["Counts are rounded down to 10."]);
  });
});

describe("the real card of RUN-FAEC", () => {
  const card = real as unknown as {
    variables: Parameters<typeof readiness>[0] & Parameters<typeof groupIssues>[0];
    caveats: string[];
    gaps: string[];
  };
  const lines = [...card.caveats, ...card.gaps];

  it("counts 4 of 6 variables ready", () => {
    expect(readiness(card.variables)).toEqual({ total: 6, ready: 4, check: 1, important: 1 });
  });

  it("sorts the lines into four plain groups", () => {
    const groups = groupIssues(card.variables, lines);
    expect(groups.map((g) => g.id)).toEqual(["missing", "privacy", "dictionary"]);
    expect(groups[0]).toMatchObject({ severity: "high" });
    expect(groups[0].items).toHaveLength(2);
    const dictionary = groups.find((g) => g.id === "dictionary");
    expect(dictionary?.items).toHaveLength(1);
    expect(dictionary?.items[0].text).toContain("time axis");
    expect(dictionary?.items[0].text).not.toContain("no place on the timeline");
    const privacy = groups.find((g) => g.id === "privacy");
    expect(privacy?.items.map((i) => i.text).join(" ")).toContain("hidden because each belongs to a single row");
  });

  it("turns the disclosure lines into counted chips", () => {
    const chips = privacyChips(card.variables, lines);
    expect(chips.map((c) => c.label)).toEqual([
      "Rounded counts",
      "Strict disclosure",
      "Labels withheld",
      "Extremes withheld",
    ]);
    expect(chips.find((c) => c.label === "Extremes withheld")?.count).toBe(4);
  });

  it("tells key, target and input apart", () => {
    expect(card.variables.map((v) => roleKind(v))).toEqual(["key", "none", "input", "target", "input", "none"]);
  });
});

describe("stageOutcomePending", () => {
  const run = (status: string, stage?: { status: string; phase: string }) => ({ status, current_stage: stage ?? null });
  it("shows Accept for a finished stage, and for an open stage-outcome question whatever the stage says", () => {
    expect(stageOutcomePending(run("awaiting_review", { status: "COMPLETED", phase: "published" }))).toBe(true);
    expect(stageOutcomePending(run("awaiting_review"), [{ kind: "stage_outcome", decided_at: null }])).toBe(true);
  });
  it("does not for a release wait, a decided question, or another status", () => {
    expect(stageOutcomePending(run("awaiting_review", { status: "awaiting_review", phase: "release_review" }))).toBe(
      false,
    );
    expect(stageOutcomePending(run("awaiting_review"), [{ kind: "stage_outcome", decided_at: "2026-11-16" }])).toBe(
      false,
    );
    expect(stageOutcomePending(run("running"), [{ kind: "stage_outcome", decided_at: null }])).toBe(false);
  });
});

describe("hand-off needs a chosen question", () => {
  it("is false for a brief without one, true with one", () => {
    expect(hasChosenQuestion(null)).toBe(false);
    expect(hasChosenQuestion({ chosen: null })).toBe(false);
    expect(hasChosenQuestion({ chosen: { question_id: "Q1" } })).toBe(true);
  });

  it("finds the open run that locks the launcher (RUN_ACTIVE)", () => {
    const runs = [{ status: "completed" }, { status: "failed" }, { status: "awaiting_review", id: "open" }];
    expect(openRunOf(runs)).toMatchObject({ id: "open" });
    expect(openRunOf(runs.slice(0, 2))).toBeUndefined();
  });
});

describe("charterPendingFor", () => {
  const open = { kind: "charter", authority: "researcher", decided_at: null };

  it("is true for an open run with an undecided plan for the researcher", () => {
    expect(charterPendingFor({ status: "running" }, [open])).toBe(true);
  });

  it("is false once decided, for the PI's own plan, or for a finished run", () => {
    expect(charterPendingFor({ status: "running" }, [{ ...open, decided_at: "2026-11-16T10:00:00Z" }])).toBe(false);
    expect(charterPendingFor({ status: "running" }, [{ ...open, authority: "pi" }])).toBe(false);
    expect(charterPendingFor({ status: "completed" }, [open])).toBe(false);
  });
});
