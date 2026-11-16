import { describe, expect, it } from "vitest";

import { runsOfVersion } from "@/lib/api/services/fetch-dataset-runs";
import type { LocalNodeItem } from "@/lib/api/services/fetch-local-nodes";
import type { RunItem } from "@/lib/api/services/fetch-runs";

import {
  latestUsableRun,
  missingPercent,
  nodeReadiness,
  stageLabel,
  stageLine,
  stageStatusLabel,
  stageSteps,
} from "./dataset-stage-state";

const local = { storage: "local" as const, runner_id: "n1" };
const node = (patch: Partial<LocalNodeItem> = {}): LocalNodeItem => ({
  id: "n1",
  name: "Lab PC",
  created_at: "2026-01-01T00:00:00Z",
  last_seen_at: null,
  online: true,
  revoked: false,
  paired_node: true,
  node_version: "1",
  release_count: 0,
  pending_reviews: 0,
  capabilities: {
    contract_version: "1",
    node_version: "1",
    families: [{ family: "data_card", kind: "profile", scopes: ["whole"], max_calls: 1 }],
    floors: {},
    isolation: "none",
  },
  ...patch,
});
const run = (status: string, version = "v1"): RunItem =>
  ({ id: status, dataset_version_id: version, status }) as RunItem;

describe("nodeReadiness", () => {
  it("needs no node for Platform data", () => {
    expect(nodeReadiness({ storage: "platform", runner_id: null }, [])).toEqual({ state: "ready" });
  });

  it("explains each reason a local version cannot start", () => {
    const title = (nodes: LocalNodeItem[]) => {
      const result = nodeReadiness(local, nodes);
      return result.state === "blocked" ? result.title : result.state;
    };
    expect(title([])).toMatch(/No paired Local Node/);
    expect(title([node({ online: false })])).toMatch(/offline/);
    expect(title([node({ approval: "pending" })])).toMatch(/approval/);
    expect(title([node({ capabilities: { ...node().capabilities!, families: [] } })])).toBe(
      "This Local Node cannot build a data card yet",
    );
    expect(title([node({ capabilities: null })])).toBe("unknown_capabilities");
    expect(title([node()])).toBe("ready");
  });
});

describe("stage steps and runs", () => {
  it("marks the release review for a local version only", () => {
    expect(stageSteps(local, node()).some((step) => step.approve)).toBe(true);
    expect(stageSteps({ storage: "platform" }, undefined).some((step) => step.approve)).toBe(false);
  });

  it("maps run status and picks the newest usable run", () => {
    expect(stageLine(run("awaiting_review"))).toBe("waiting_review");
    expect(stageLine(run("paused"))).toBe("waiting_node");
    expect(latestUsableRun([run("failed"), run("completed")])?.status).toBe("completed");
    expect(runsOfVersion([run("a", "v1"), run("b", "v2")], "v2")).toHaveLength(1);
  });

  it("withholds a missing percentage when a count is withheld", () => {
    expect(missingPercent({ n_valid: 90, n_missing: 10 })).toBe(10);
    expect(missingPercent({ n_valid: null, n_missing: 10 })).toBeNull();
  });
});

describe("stageLabel", () => {
  const stage = (status: string, phase: string) =>
    ({
      ...run("awaiting_review"),
      current_stage: { stage_run_id: "s", stage_key: "dataset", status, phase },
    }) as RunItem;

  it("says a finished stage waits for you to accept it", () => {
    expect(stageLabel(stage("COMPLETED", "published"))).toBe("Waiting for you to accept");
    expect(stageLabel(stage("RUNNING", "release_review"))).toBeNull();
  });

  it("names failed and stopped runs", () => {
    expect(stageLabel(run("failed"))).toBe("Failed");
    expect(stageLabel(run("stopped"))).toBe("Stopped");
    expect(stageLabel(run("completed"))).toBeNull();
  });
});

describe("stageStatusLabel", () => {
  it("uses one label for the badge and the run list", () => {
    const waiting = { ...run("awaiting_review"), current_stage: null } as RunItem;
    expect(stageStatusLabel(waiting)).toBeNull();
    expect(stageStatusLabel(waiting, [{ kind: "stage_outcome", decided_at: null }])).toBe("Waiting for you to accept");
    expect(stageStatusLabel(run("failed"))).toBe("Failed");
  });
});
