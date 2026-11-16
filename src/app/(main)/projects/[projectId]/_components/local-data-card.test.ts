import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { DatasetVersionItem, LocalCard } from "@/lib/api/services/fetch-datasets";

import { LocalVersionNotice } from "./local-version-notice";

const variable: LocalCard["variables"][number] = {
  name: "age",
  type: "numeric",
  measure: "scale",
  kind: "single",
  role: "input",
  summary: { n_valid: 950, n_missing: 50, n_distinct: 60, mean: 30, sd: 5 },
  flags: ["levels_withheld"],
};
const card: LocalCard = {
  n_rows: 1280,
  variables: [variable, { ...variable, name: "v1", flags: ["possible_pii", "near_unique", "levels_withheld"] }],
  split: {
    method: "random_rows",
    unit_column: null,
    seed: 123,
    exploration_fraction: 0.3,
    n_exploration: 380,
    n_confirmation: 890,
    mask_sha256: null,
  },
  report: { gaps: ["Quantiles were withheld."] },
  disclosure: "standard",
};
const version: DatasetVersionItem = {
  id: "version",
  dataset_id: "dataset",
  version_number: 2,
  original_filename: "study.csv",
  size_bytes: 1000,
  sha256: "a".repeat(64),
  row_count: 1280,
  column_names: ["age", "v1"],
  source_type: "upload",
  source: null,
  storage: "local",
  disclosure: "standard",
  created_by_user_id: "user",
  created_at: "2026-11-13T00:00:00Z",
  local_card: card,
};

function render(localCard: LocalCard | null | undefined = card) {
  return renderToStaticMarkup(
    createElement(
      TooltipProvider,
      null,
      createElement(LocalVersionNotice, { version: { ...version, local_card: localCard } }),
    ),
  );
}

describe("Local data card", () => {
  it("renders shared names, aliases, rounded counts, split and gaps from the released card", () => {
    const html = render();
    for (const text of [
      "v2",
      "stays on a Local Node",
      "Local Node",
      "Standard",
      "~1,280",
      "70",
      "age",
      "v1",
      "~60",
      "1 limits from the Local Node",
    ]) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain("There is no preview or download");
  });

  it("shows warning flags and a single category-label disclosure instead of per-variable levels_withheld badges", () => {
    const html = render();
    expect(html).toContain("Possible PII");
    expect(html).toContain("Near unique");
    expect(html).not.toContain("levels_withheld");
  });

  it("uses missing bands with inclusive 5% and 20% boundaries and never guesses withheld counts", () => {
    const summaries = [
      { n_valid: 960, n_missing: 40 },
      { n_valid: 950, n_missing: 50 },
      { n_valid: 800, n_missing: 200 },
      { n_valid: 790, n_missing: 210 },
      { n_valid: null, n_missing: 10 },
      { n_valid: 1000, n_missing: null },
      { n_valid: 0, n_missing: 0 },
    ];
    const html = render({
      ...card,
      variables: summaries.map((summary, index) => ({
        ...variable,
        name: `v${index}`,
        summary: { ...variable.summary, ...summary, n_distinct: null },
      })),
    });
    expect(html).toContain("&lt;5%");
    expect(html).toContain("5–20%");
    expect(html).toContain("&gt;20%");
    expect(html).toMatch(/>withheld</);
    expect(html).not.toContain("NaN");
  });

  it("retains the previous notice when the card is null or absent", () => {
    for (const localCard of [null, undefined]) {
      const html = renderToStaticMarkup(
        createElement(LocalVersionNotice, { version: { ...version, local_card: localCard } }),
      );
      expect(html).toContain("There is no preview or download");
      expect(html).not.toContain('aria-label="Local data card"');
    }
  });

  it("handles strict cards, zero distinct values and no variables or gaps", () => {
    const html = render({
      ...card,
      disclosure: "strict",
      report: { gaps: [] },
      variables: [{ ...variable, flags: ["constant"], summary: { ...variable.summary, n_distinct: 0 } }],
    });
    expect(html).toContain("Strict");
    expect(html).toContain("~0");
    expect(html).toContain("Constant");
    expect(html).not.toContain("limits from the Local Node");
    expect(render({ ...card, variables: [] })).toContain("No variable summaries were released");
  });
});
