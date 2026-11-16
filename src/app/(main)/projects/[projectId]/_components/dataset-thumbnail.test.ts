import { describe, expect, it } from "vitest";

import { toggleDatasetLibraryView } from "./dataset-library-state";
import { missingRatio, thumbnailKind, thumbnailSummary } from "./dataset-thumbnail";

describe("dataset card thumbnail mapping", () => {
  it("maps released variable types to compact thumbnail kinds", () => {
    expect(thumbnailKind("numeric")).toBe("number");
    expect(thumbnailKind("string")).toBe("text");
    expect(thumbnailKind("date")).toBe("date");
    expect(thumbnailKind("boolean")).toBe("boolean");
  });

  it("shows missing bands only when the profile reports a valid ratio", () => {
    expect(missingRatio(25, 100)).toBe(0.25);
    expect(missingRatio(null, 100)).toBeNull();
    expect(missingRatio(3, 0)).toBeNull();
  });

  it("toggles between Cards and Table", () => {
    expect(toggleDatasetLibraryView("cards")).toBe("table");
    expect(toggleDatasetLibraryView("table")).toBe("cards");
  });

  it("summarizes columns and high-missing flags for the thumbnail tooltip", () => {
    expect(
      thumbnailSummary([
        { type: "numeric", flags: ["high_missing"], summary: { n_missing: 20 } },
        { type: "numeric", flags: [], summary: { n_missing: 0 } },
        { type: "string", flags: [], summary: { n_missing: null } },
      ]),
    ).toBe("3 columns · 2 numeric, 1 text · 1 high missing");
  });
});
