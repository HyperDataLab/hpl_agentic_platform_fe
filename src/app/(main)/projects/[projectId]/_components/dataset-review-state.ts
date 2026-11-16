// What the data card says, put in plain words for the researcher. Everything here comes from the card's own flags,
// missing counts and notes; nothing is guessed about the data.

interface Variable {
  name: string;
  role: string;
  summary: { n_valid: number | null; n_missing: number | null };
  flags: string[];
}

export interface Issue {
  severity: "high" | "medium" | "info";
  text: string;
  /** The flag or limit it came from, with a longer explanation for a tooltip. */
  hint?: string;
}

/** What each flag means for the person reading, without the code name. */
export const FLAG_HINTS: Record<string, string> = {
  possible_pii: "May contain personally identifying information (names, emails, ids).",
  near_unique: "Almost every row has its own value, so the column works as an id, not as something to analyse.",
  high_missing: "More than 20% of the values are missing.",
  free_text: "Free text instead of a fixed set of categories; it cannot be summarised by counts.",
  constant: "Every row has the same value, so it cannot explain anything.",
  numeric_with_text_codes:
    "A number column that also holds text codes (such as 'n/a'); they are not counted as numbers.",
  small_categories: "Some categories are so small that the Local Node hides their counts to protect people.",
  top_coded:
    "The largest values are grouped together or capped to protect privacy, so the mean and the maximum can be lower than the real ones.",
};

/** Role as a person reads it. */
export const ROLE_LABEL: Record<string, string> = {
  target: "Target · the outcome you explain",
  input: "Input · explains the outcome",
  both: "Input and target",
  none: "None · not assigned yet",
  partition: "Groups the rows",
  split: "Splits exploration from confirmation",
};

export const humanFlag = (flag: string) => flag.replaceAll("_", " ");

const percent = (v: Variable) => {
  const { n_valid: valid, n_missing: missing } = v.summary;
  return valid == null || missing == null || valid + missing === 0
    ? null
    : Math.round((missing / (valid + missing)) * 100);
};

/** The things worth a look, worst first. */
export function issuesOf(variables: Variable[], notes: string[] = []): Issue[] {
  const issues: Issue[] = [];
  for (const v of variables) {
    const missing = percent(v);
    if (missing !== null && missing >= 5)
      issues.push({
        severity: missing >= 20 ? "high" : "medium",
        text: `${v.name} is missing ${missing}% of its values.`,
        hint: FLAG_HINTS.high_missing,
      });
    for (const flag of v.flags) {
      if (flag === "levels_withheld" || flag === "high_missing") continue;
      const hint = FLAG_HINTS[flag];
      const text =
        flag === "near_unique"
          ? `${v.name} is almost unique on each row, so it is a key, not a variable to analyse.`
          : flag === "top_coded"
            ? `The largest values of ${v.name} are grouped to protect privacy, so its mean may read low.`
            : flag === "possible_pii"
              ? `${v.name} may identify people.`
              : flag === "constant"
                ? `${v.name} has one value on every row.`
                : `${v.name}: ${humanFlag(flag)}.`;
      issues.push({ severity: flag === "possible_pii" || flag === "near_unique" ? "medium" : "info", text, hint });
    }
  }
  for (const note of notes) issues.push({ severity: "info", text: note });
  const order = { high: 0, medium: 1, info: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

const KEPT = /^Not computed on the Local Node:\s*(.+)$/i;
const NAMES: Record<string, string> = {
  text_variants: "spelling variants of text values",
  levels: "the list of category values",
};

/** The limits that are the Local Node keeping something private, in plain words, apart from other notes. */
export function privacyNotes(lines: string[]): { kept: string[]; other: string[] } {
  const kept: string[] = [];
  const other: string[] = [];
  for (const line of lines) {
    const m = line.match(KEPT);
    if (!m) {
      other.push(line);
      continue;
    }
    for (const part of m[1].split(/,\s*/)) {
      const name = part.replace(/\s*\(.*\)\s*$/, "").trim();
      const withheld = /levels withheld/i.test(part);
      kept.push(
        `${NAMES[name] ? `${NAMES[name][0].toUpperCase()}${NAMES[name].slice(1)}` : humanFlag(name)} ${withheld ? "are" : "is"} not computed here${withheld ? ": the category values stay on your computer" : ""}.`,
      );
    }
  }
  return { kept, other };
}

// ---------- the review as a dashboard ----------

type Level = "ready" | "check" | "important";

interface CardVariable extends Variable {
  kind?: string;
}

/** How a variable stands: missing data and flags that can mislead set it; privacy flags and dictionary gaps do not. */
export function variableLevel(v: Variable): Level {
  const missing = percent(v);
  if (missing !== null && missing >= 20) return "important";
  if (missing !== null && missing >= 5) return "check";
  return v.flags.some((f) =>
    ["possible_pii", "near_unique", "constant", "numeric_with_text_codes", "free_text"].includes(f),
  )
    ? "check"
    : "ready";
}

export function readiness(variables: Variable[]) {
  const levels = variables.map(variableLevel);
  return {
    total: variables.length,
    ready: levels.filter((l) => l === "ready").length,
    check: levels.filter((l) => l === "check").length,
    important: levels.filter((l) => l === "important").length,
  };
}

export type RoleKind = "target" | "input" | "key" | "none" | "other";

export function roleKind(v: CardVariable): RoleKind {
  if (v.kind === "identifier") return "key";
  if (v.role === "target") return "target";
  if (v.role === "input" || v.role === "both") return "input";
  if (v.role === "none") return "none";
  return "other";
}

export type IssueGroupId = "missing" | "privacy" | "dictionary" | "other";

export interface IssueGroup {
  id: IssueGroupId;
  label: string;
  severity: "high" | "medium" | "info";
  summary: string;
  items: { text: string; hint?: string }[];
}

const TIME_GAP = /^dictionary:\s*(\w+):\s*no place on the timeline/i;
const LIST = (names: string[]) =>
  names.length > 3 ? `${names.slice(0, 3).join(", ")} and ${names.length - 3} more` : names.join(", ");

/** Sorts what the card says into four kinds of attention, each said once, in plain words. */
export function groupIssues(variables: CardVariable[], lines: string[]): IssueGroup[] {
  const missing: IssueGroup["items"] = [];
  let missingTop = "info" as IssueGroup["severity"];
  for (const v of variables) {
    const pct = percent(v);
    if (pct === null || pct < 5) continue;
    missing.push({ text: `${v.name} is missing ${pct}% of its values.`, hint: FLAG_HINTS.high_missing });
    missingTop = pct >= 20 || missingTop === "high" ? "high" : "medium";
  }

  const privacy: IssueGroup["items"] = [];
  const top = variables.filter((v) => v.flags.includes("top_coded")).map((v) => v.name);
  if (top.length)
    privacy.push({
      text: `The largest values of ${LIST(top)} are grouped, so their means may read low.`,
      hint: FLAG_HINTS.top_coded,
    });
  for (const v of variables)
    if (v.flags.includes("possible_pii"))
      privacy.push({ text: `${v.name} may identify people.`, hint: FLAG_HINTS.possible_pii });

  const dictionary: IssueGroup["items"] = [];
  const noTime: string[] = [];
  const other: IssueGroup["items"] = [];
  for (const line of lines) {
    const time = line.match(TIME_GAP);
    if (time) noTime.push(time[1]);
    else if (/^dictionary:/i.test(line))
      dictionary.push({ text: line.replace(/^dictionary:\s*/i, "").replace(/^(\w+):\s*/, "$1: ") });
    else if (/min and max .* single values of one row/i.test(line))
      privacy.push({
        text: "The smallest and largest values are hidden because each belongs to a single row.",
        hint: "Showing them would reveal one person's value.",
      });
    else if (/^Not computed on the Local Node/i.test(line) || /disclosure|rounded|withholds/i.test(line)) continue;
    else other.push({ text: line });
  }
  if (noTime.length)
    dictionary.unshift({
      text: `For ${LIST(noTime)}, it is not known whether they are measured before, with or after the outcome (their time axis).`,
      hint: "The dictionary has no time axis for them; later stages need it to avoid using an effect as a cause.",
    });
  for (const v of variables)
    if (
      v.flags.includes("free_text") ||
      v.flags.includes("constant") ||
      v.flags.includes("numeric_with_text_codes") ||
      v.flags.includes("near_unique")
    )
      other.push({
        text: v.flags.includes("near_unique")
          ? `${v.name} is almost unique on each row, so it is a key, not a variable to analyse.`
          : `${v.name}: ${v.flags
              .filter((f) => FLAG_HINTS[f] && f !== "top_coded" && f !== "possible_pii")
              .map(humanFlag)
              .join(", ")}.`,
        hint: FLAG_HINTS[v.flags.find((f) => FLAG_HINTS[f] && f !== "top_coded") ?? ""],
      });

  const groups: IssueGroup[] = [
    {
      id: "missing",
      label: "Missing data",
      severity: missingTop,
      summary: `${missing.length} ${missing.length === 1 ? "variable has" : "variables have"} gaps.`,
      items: missing,
    },
    {
      id: "privacy",
      label: "Privacy",
      severity: "info",
      summary: "Some values were grouped or hidden to protect people.",
      items: privacy,
    },
    {
      id: "dictionary",
      label: "Dictionary gaps",
      severity: "medium",
      summary: "Some columns lack meaning, unit or time axis.",
      items: dictionary,
    },
    { id: "other", label: "Other", severity: "info", summary: "Other things the card notes.", items: other },
  ];
  return groups.filter((g) => g.items.length);
}

export interface PrivacyChip {
  label: string;
  count?: number;
  hint: string;
}

/** The disclosure rules the Local Node applied, as a few chips; each carries its own sentence from the card. */
export function privacyChips(variables: Variable[], lines: string[]): PrivacyChip[] {
  const find = (re: RegExp) => lines.find((l) => re.test(l));
  const chips: PrivacyChip[] = [];
  const rounded = find(/rounded/i);
  if (rounded) chips.push({ label: "Rounded counts", hint: rounded });
  const strict = find(/strict disclosure/i);
  if (strict) chips.push({ label: "Strict disclosure", hint: strict });
  const sig = find(/significant figures/i);
  if (sig) chips.push({ label: "Means to 2 figures", hint: sig });
  const labels = find(/withholds category labels/i);
  if (labels)
    chips.push({
      label: "Labels withheld",
      count: variables.filter((v) => v.flags.includes("levels_withheld")).length || undefined,
      hint: labels,
    });
  const extremes = find(/withholds (quantiles|minimum)/i) ?? find(/min and max/i);
  if (extremes)
    chips.push({
      label: "Extremes withheld",
      count: variables.filter((v) => v.flags.includes("top_coded")).length || undefined,
      hint: extremes,
    });
  return chips;
}

interface ConsultationLike {
  kind: string;
  decided_at?: string | null;
  status?: string;
}

/** The PI's plan waits for you to endorse it: an open charter question to the researcher on a run still open. */
export function charterPendingFor(
  run: { status: string } | undefined,
  consultations: { kind: string; authority?: string; decided_at?: string | null }[] = [],
): boolean {
  if (!run || !["queued", "running", "awaiting_review"].includes(run.status)) return false;
  return consultations.some((c) => c.kind === "charter" && c.authority === "researcher" && !c.decided_at);
}

/** The finished stage asks to be accepted: the run says so, or an open stage-outcome question to you exists. */
export function stageOutcomePending(
  run: { status: string; current_stage?: { status?: string; phase?: string | null } | null } | undefined,
  consultations: ConsultationLike[] = [],
): boolean {
  if (!run || run.status !== "awaiting_review") return false;
  const stage = `${run.current_stage?.status ?? ""} ${run.current_stage?.phase ?? ""}`.toLowerCase();
  return /completed|published/.test(stage) || consultations.some((c) => c.kind === "stage_outcome" && !c.decided_at);
}

/** The backend hands the stage off only when the brief names the question it answers. */
export function hasChosenQuestion(brief: { chosen?: unknown } | null | undefined): boolean {
  return Boolean(brief?.chosen);
}

const OPEN_STATUSES = ["queued", "running", "awaiting_review", "paused"];

/** A run of the project that is still open; the backend allows one at a time (RUN_ACTIVE). */
export function openRunOf<T extends { status: string }>(runs: T[]): T | undefined {
  return runs.find((run) => OPEN_STATUSES.includes(run.status));
}
