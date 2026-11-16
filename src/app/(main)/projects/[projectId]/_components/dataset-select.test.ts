import { describe, expect, it } from "vitest";

import { fetchDatasetRuns } from "@/lib/api/services/fetch-dataset-runs";
import type { RunInput } from "@/lib/run-stream/contract";
import { createRunRequest } from "@/lib/run-stream/run-store";

import { researchRunHref } from "./dataset-select";

const input: RunInput = {
  problem: "Does commute time vary by travel mode?",
  intent: { kind: "compare", text: "Compare travel mode groups." },
  domains: ["transport"],
};

describe("dataset selection for research runs", () => {
  it("includes the selected dataset version in the research run request", () => {
    expect(createRunRequest("light", input, "version-7")).toMatchObject({ dataset_version_id: "version-7" });
  });

  it("omits dataset_version_id when no dataset is selected", () => {
    expect(createRunRequest("light", input)).not.toHaveProperty("dataset_version_id");
  });

  it("links the dataset CTA to the launcher with the selected version", () => {
    expect(researchRunHref("project/1", "dataset/1", "version/7")).toBe(
      "/projects/project%2F1/experiments?dataset_id=dataset%2F1&dataset_version_id=version%2F7#start-run",
    );
  });

  it("does not expose a standalone Dataset run creator", () => {
    expect(fetchDatasetRuns).not.toHaveProperty("create");
  });
});
