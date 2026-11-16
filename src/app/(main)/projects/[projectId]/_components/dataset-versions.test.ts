import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DatasetVersionStatusBadges, datasetVersionStatuses, SupersededVersionBadge } from "./dataset-versions";

describe("Superseded version badge", () => {
  it("renders the replacement version without changing version history", () => {
    const html = renderToStaticMarkup(createElement(SupersededVersionBadge, { version: { superseded_by_version: 3 } }));
    expect(html).toContain("Superseded by v3");
    expect(html).toContain('data-slot="badge"');
  });

  it("hides the badge for legacy and current versions", () => {
    for (const version of [{}, { superseded_by_version: null }]) {
      expect(renderToStaticMarkup(createElement(SupersededVersionBadge, { version }))).toBe("");
    }
  });
});

describe("dataset version status badges", () => {
  it("maps the current version to Latest", () => {
    expect(datasetVersionStatuses({ superseded_by_version: null }, true)).toEqual(["latest"]);
  });

  it("maps a replaced version to Superseded by vN", () => {
    expect(datasetVersionStatuses({ superseded_by_version: 3 }, false)).toEqual(["superseded"]);
    const html = renderToStaticMarkup(
      createElement(DatasetVersionStatusBadges, { version: { superseded_by_version: 3 } }),
    );
    expect(html).toContain("Superseded by v3");
  });

  it("adds Stale evidence only when the stale flag is true", () => {
    expect(datasetVersionStatuses({ superseded_by_version: 3, stale: true }, false)).toEqual(["superseded", "stale"]);
    expect(datasetVersionStatuses({ superseded_by_version: 3, stale: false }, false)).toEqual(["superseded"]);
    const html = renderToStaticMarkup(
      createElement(DatasetVersionStatusBadges, {
        version: { superseded_by_version: 3, stale: true },
      }),
    );
    expect(html).toContain("Stale evidence");
  });
});
