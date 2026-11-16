import { beforeEach, describe, expect, it, vi } from "vitest";

import apiService from "../core";
import {
  type CapabilityManifest,
  describeRelease,
  fetchLocalNodes,
  type LocalNodeItem,
  type LocalNodeRelease,
  localNodeState,
} from "./fetch-local-nodes";

vi.mock("../core", () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

const ok = (data: unknown) => ({ data: { success: true, data } }) as Awaited<ReturnType<typeof apiService.get>>;

describe("Local Node requests", () => {
  it("preserves reported, unknown and null capabilities from the existing list response", async () => {
    const capabilities: CapabilityManifest = {
      contract_version: "1",
      node_version: "0.1.0",
      families: [
        { family: "table_row_count", kind: "table", op: "hash", scopes: ["whole"], max_calls: 1 },
        { family: "future_family", kind: "profile", scopes: ["exploration", "confirmation"], max_calls: 2 },
      ],
      floors: { min_cell: 5, k_min: 5 },
      isolation: "appcontainer",
      runtime_pin_sha256: null,
    };
    const node: LocalNodeItem = {
      id: "node-1",
      name: "Lab laptop",
      created_at: "2026-11-13T00:00:00Z",
      last_seen_at: null,
      online: false,
      revoked: false,
      paired_node: true,
      node_version: "0.1.0",
      release_count: 0,
      pending_reviews: 0,
      connection: "pairing_code",
      capabilities,
    };
    const nodes: LocalNodeItem[] = [node, { ...node, id: "node-2", capabilities: null }];
    vi.mocked(apiService.get).mockResolvedValue(ok(nodes));

    const response = await fetchLocalNodes.list("p1");

    expect(response.data).toEqual(nodes);
    expect(response.data[0].capabilities).toEqual(capabilities);
    expect(response.data[1].capabilities).toBeNull();
    expect(apiService.get).toHaveBeenCalledExactlyOnceWith("/projects/p1/runners", undefined, { signal: undefined });
  });

  it("uses the project's runner routes with encoded ids", async () => {
    vi.mocked(apiService.get).mockResolvedValue(ok([]));
    vi.mocked(apiService.delete).mockResolvedValue(ok(null));
    const signal = new AbortController().signal;

    await fetchLocalNodes.list("p 1", signal);
    expect(apiService.get).toHaveBeenLastCalledWith("/projects/p%201/runners", undefined, { signal });

    await fetchLocalNodes.revoke("p 1", "r/1");
    expect(apiService.delete).toHaveBeenCalledWith("/projects/p%201/runners/r%2F1");

    await fetchLocalNodes.releases("p 1", "r/1", signal);
    expect(apiService.get).toHaveBeenLastCalledWith("/projects/p%201/runners/r%2F1/releases", undefined, { signal });
  });
});

describe("Local Node display helpers", () => {
  const describeResult = (result: LocalNodeRelease["result"]) => describeRelease({ result } as LocalNodeRelease);

  it("describes row counts with the released rounding step", () => {
    expect(describeResult({ table: [{ rows: 1200, rounding_step: 20 }] })).toEqual({
      family: "table_row_count",
      title: "Row count · ~1,200 (rounded to 20)",
      lines: [],
    });
  });

  it("counts each missingness band without exposing column values", () => {
    expect(describeResult({ table: [{ missing_bands: ["lt_5", "5_20", "gt_20", "lt_5"] }] })).toEqual({
      family: "missingness_band",
      title: "Missing data · 4 columns: 2 under 5%, 1 5–20%, 1 over 20%",
      lines: [],
    });
  });

  it("lists distribution shapes and tails in column order", () => {
    expect(
      describeResult({
        table: [
          {
            distribution: [
              { shape: "symmetric", tails: "normal_like" },
              { shape: "right_skewed", tails: "heavy" },
              { shape: "left_skewed", tails: "unknown" },
              { shape: "concentrated", tails: "unknown" },
            ],
          },
        ],
      }),
    ).toEqual({
      family: "distribution_band",
      title: "Distribution · 4 columns",
      lines: [
        "Column 1: Symmetric, normal-like tails",
        "Column 2: Right skewed, heavy tails",
        "Column 3: Left skewed, unknown tails",
        "Column 4: Concentrated, unknown tails",
      ],
    });
  });

  it.each<[number, string]>([
    [-79, "-0.79"],
    [0, "0"],
    [100, "1"],
  ])("describes correlation %s in hundredths", (rho, label) => {
    expect(describeResult({ table: [{ rho_hundredths: rho, n: 1200 }] })).toEqual({
      family: "rank_correlation",
      title: `Rank correlation · ρ = ${label} (n ≈ 1,200)`,
      lines: [],
    });
  });

  it("counts the variables in the D2 profile", () => {
    expect(describeResult({ table: null, profile: { variables: [{ name: "v1" }, { name: "shared" }] } })).toEqual({
      family: "data_card",
      title: "Data card · 2 variables",
      lines: [],
    });
    expect(describeResult({ profile: { variables: [] } }).title).toBe("Data card · 0 variables");
  });

  it("falls back to a table count for an unknown shape without exposing its contents", () => {
    expect(describeResult({ table: [{ secret: "CANARY" }, { future: { key: 1 } }] })).toEqual({
      family: "unknown",
      title: "Released result",
      lines: ["2 tables"],
    });
  });

  it.each<LocalNodeRelease["result"]>([
    {},
    { table: null },
    { profile: null },
    { table: [null] },
    { table: [{ rows: 20 }] },
    { table: [{ rows: Number.NaN, rounding_step: 10 }] },
    { table: [{ missing_bands: ["future_band"] }] },
    { table: [{ distribution: [{ shape: "CANARY", tails: "heavy" }] }] },
    { table: [{ rho_hundredths: "79", n: 100 }] },
  ])("handles missing or unrecognized aggregate fields: %j", (result) => {
    const description = describeResult(result);
    expect(description.family).toBe("unknown");
    expect(description.title).toBe("Released result");
    expect(description.lines).toEqual([result.table?.length === 1 ? "1 table" : "0 tables"]);
  });

  it("puts revocation before online status", () => {
    expect(localNodeState({ online: true, revoked: true })).toBe("revoked");
    expect(localNodeState({ online: true, revoked: false })).toBe("online");
    expect(localNodeState({ online: false, revoked: false })).toBe("offline");
  });
});
