import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { StaleReleaseBadge } from "./settings-local-nodes";

function renderBadge(release: Parameters<typeof StaleReleaseBadge>[0]["release"]) {
  return renderToStaticMarkup(createElement(TooltipProvider, null, createElement(StaleReleaseBadge, { release })));
}

describe("Stale release badge", () => {
  it("renders a focusable badge describing the replacement version", () => {
    const html = renderBadge({ stale: true, superseded_by_version: 4 });
    expect(html).toContain(">Stale</span>");
    expect(html).toContain("A newer version v4 of this dataset exists");
    expect(html).toContain('tabindex="0"');
  });

  it("handles stale releases with no replacement version", () => {
    const html = renderBadge({ stale: true, superseded_by_version: null });
    expect(html).toContain("A newer version of this dataset exists");
    expect(html).not.toMatch(/vnull|vundefined/);
  });

  it("hides the badge unless the backend marks the release stale", () => {
    for (const release of [{}, { stale: false }, { superseded_by_version: 4 }]) {
      expect(renderBadge(release)).toBe("");
    }
  });
});
