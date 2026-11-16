import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  LocalNodeWaitBanner,
  RELEASE_REVIEW_MESSAGE,
  ReleaseReviewIcon,
  RunFailureMessage,
  SupersededDatasetBanner,
} from "./local-node-status";

describe("Local Node run status", () => {
  it("names the newer dataset version when the run event supplies it", () => {
    const html = renderToStaticMarkup(
      createElement(SupersededDatasetBanner, { state: { dataset_superseded: true, superseded_by_version: 3 } }),
    );
    expect(html).toContain("v3 is available.");
    expect(html).toContain("Its results stay in history;");
    expect(html).toContain('role="status"');
    expect(renderToStaticMarkup(createElement(SupersededDatasetBanner, { state: { superseded_by_version: 3 } }))).toBe(
      "",
    );
  });

  it("shows a neutral dataset warning only when explicitly superseded", () => {
    expect(renderToStaticMarkup(createElement(SupersededDatasetBanner, { state: {} }))).toBe("");
    const html = renderToStaticMarkup(createElement(SupersededDatasetBanner, { state: { dataset_superseded: true } }));
    expect(html).toContain(
      "This run uses an older version of the dataset. Its results stay in history; a newer version exists.",
    );
    expect(html).toContain('role="status"');
    expect(html).not.toContain('role="alert"');
  });

  it("renders an offline pause as a neutral status", () => {
    const html = renderToStaticMarkup(
      createElement(LocalNodeWaitBanner, { state: { lifecycle: "paused", pauseReason: "runner_offline" } }),
    );
    expect(html).toContain("Waiting for the Local Node. The run continues when it reconnects.");
    expect(html).toContain('role="status"');
    expect(html).not.toMatch(/text-destructive|bg-rose|text-rose|role="alert"/);
  });

  it("removes the banner after reconnecting and for other pauses", () => {
    for (const state of [
      { lifecycle: "running", pauseReason: "runner_offline" },
      { lifecycle: "paused", pauseReason: "researcher" },
    ] as const) {
      expect(renderToStaticMarkup(createElement(LocalNodeWaitBanner, { state }))).toBe("");
    }
  });

  it("adds a Clock only to the release review progress line", () => {
    const html = renderToStaticMarkup(createElement(ReleaseReviewIcon, { text: RELEASE_REVIEW_MESSAGE }));
    expect(html).toContain("lucide-clock");
    expect(html).not.toContain('role="alert"');
    expect(renderToStaticMarkup(createElement(ReleaseReviewIcon, { text: "Reading the dataset." }))).toBe("");
  });

  it("renders the step message and update hint as a capability warning", () => {
    const html = renderToStaticMarkup(
      createElement(RunFailureMessage, {
        message: "The Node cannot compute table_quality.",
        code: "LOCAL_NODE_CAPABILITY",
      }),
    );
    expect(html).toContain("The Node cannot compute table_quality.");
    expect(html).toContain("Update the Local Node");
    expect(html).toContain("lucide-triangle-alert");
    expect(html).toContain("text-amber-500");
    expect(html).not.toContain("text-destructive");
  });

  it("does not turn other failures into Local Node update advice", () => {
    const html = renderToStaticMarkup(
      createElement(RunFailureMessage, { message: "The model failed.", code: "LLM_ERROR" }),
    );
    expect(html).toContain("The model failed.");
    expect(html).toContain("Use the stages above");
    expect(html).not.toContain("Update the Local Node");
  });
});
