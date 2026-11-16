import { describe, expect, it } from "vitest";

import type { LocalCard } from "@/lib/api/services/fetch-datasets";

import { inferColumnKind } from "./dataset-preview";
import { mapProfileVariable, toggleProfileSelection } from "./dataset-workspace";

const profile: LocalCard = {
  variables: [
    {
      name: "v1",
      type: "numeric",
      measure: "scale",
      kind: "single",
      role: "input",
      summary: { n_valid: 98, n_missing: 2, n_distinct: 24, mean: 12, sd: 3 },
      flags: ["near_unique", "levels_withheld"],
    },
  ],
  n_rows: 100,
  split: {
    method: "random_rows",
    unit_column: null,
    seed: 1,
    exploration_fraction: 0.8,
    n_exploration: 80,
    n_confirmation: 20,
    mask_sha256: null,
  },
  report: { gaps: [] },
  disclosure: "standard",
};

describe("dataset profile selection", () => {
  it("uses preview values to infer remote column kinds without deriving distribution statistics", () => {
    expect(inferColumnKind(["28", "41", "33"])).toBe("number");
    expect(inferColumnKind(["Bus", "Rail"])).toBe("text");
  });

  it("maps a selected column card to the released variable used by the inspector", () => {
    expect(mapProfileVariable(profile, "v1")).toMatchObject({
      name: "v1",
      type: "numeric",
      measure: "scale",
      summary: { n_missing: 2, n_distinct: 24 },
    });
    expect(mapProfileVariable(profile, "unknown")).toBeUndefined();
    expect(mapProfileVariable(undefined, "v1")).toBeUndefined();
  });

  it("selects a column for the inspector and clears it when selected again", () => {
    expect(toggleProfileSelection(null, "v1")).toBe("v1");
    expect(toggleProfileSelection("v1", "v1")).toBeNull();
    expect(toggleProfileSelection("v1", "v2")).toBe("v2");
  });
});
