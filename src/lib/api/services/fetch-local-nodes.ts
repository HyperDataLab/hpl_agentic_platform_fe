import type { ApiResult } from "@/types/api";

import apiService from "../core";
import { projectPath } from "../request";

export interface NodeFamily {
  family: string;
  kind: "table" | "profile";
  op?: string | null;
  scopes: ("whole" | "exploration" | "confirmation")[];
  max_calls: number;
}

export interface CapabilityManifest {
  contract_version: "1";
  node_version: string;
  families: NodeFamily[];
  floors: Partial<Record<"min_cell" | "k_min", number>>;
  isolation: "appcontainer" | "none";
  runtime_pin_sha256?: string | null;
}

/** A runner of the project. `paired_node` marks a Local Node that signs releases. */
export interface LocalNodeItem {
  id: string;
  name: string;
  created_at: string;
  last_seen_at: string | null;
  online: boolean;
  revoked: boolean;
  paired_node: boolean;
  node_version: string | null;
  release_count: number;
  pending_reviews: number;
  /** `signed_in` identifies Logos sign-in; `pairing_code` is retained for older runners. */
  connection?: "signed_in" | "pairing_code" | "token";
  /** A Researcher's computer waits for a Project Manager before it gets jobs or data. */
  approval?: "approved" | "pending";
  owner_email?: string | null;
  capabilities?: CapabilityManifest | null;
}

/** One aggregate a Local Node released, with its place in the Node's signed ledger. */
export interface LocalNodeRelease {
  release_id: string;
  sequence: number;
  entry_hash: string;
  previous_hash: string;
  job_id: string;
  dataset_version_id: string;
  stale?: boolean;
  superseded_by_version?: number | null;
  snapshot_sha256: string;
  result: { table?: unknown[] | null; profile?: { variables?: unknown[] | null } | null };
  received_at: string;
}

export type LocalNodeListResponse = ApiResult<LocalNodeItem[]>;
export type LocalNodeReleaseListResponse = ApiResult<LocalNodeRelease[]>;

const runnersPath = (projectId: string) => `${projectPath(projectId)}/runners`;
const runnerPath = (projectId: string, runnerId: string) => `${runnersPath(projectId)}/${encodeURIComponent(runnerId)}`;

export const fetchLocalNodes = {
  list: async (projectId: string, signal?: AbortSignal): Promise<LocalNodeListResponse> =>
    (await apiService.get<LocalNodeListResponse>(runnersPath(projectId), undefined, { signal })).data,
  approve: async (projectId: string, runnerId: string): Promise<void> => {
    await apiService.post(`${runnerPath(projectId, runnerId)}/approve`);
  },
  revoke: async (projectId: string, runnerId: string): Promise<void> => {
    await apiService.delete(runnerPath(projectId, runnerId));
  },
  releases: async (projectId: string, runnerId: string, signal?: AbortSignal): Promise<LocalNodeReleaseListResponse> =>
    (
      await apiService.get<LocalNodeReleaseListResponse>(`${runnerPath(projectId, runnerId)}/releases`, undefined, {
        signal,
      })
    ).data,
};

export interface ReleaseDescription {
  family: "table_row_count" | "missingness_band" | "distribution_band" | "rank_correlation" | "data_card" | "unknown";
  title: string;
  lines: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const SHAPE_LABELS = new Map([
  ["symmetric", "Symmetric"],
  ["right_skewed", "Right skewed"],
  ["left_skewed", "Left skewed"],
  ["concentrated", "Concentrated"],
]);
const TAIL_LABELS = new Map([
  ["normal_like", "normal-like tails"],
  ["heavy", "heavy tails"],
  ["unknown", "unknown tails"],
]);

/** Describe only recognized aggregate shapes; future payloads never become raw JSON in the UI. */
export function describeRelease(release: LocalNodeRelease): ReleaseDescription {
  const table = release.result.table ?? [];
  const first: unknown = table[0];
  const variables = release.result.profile?.variables;
  if (Array.isArray(variables)) {
    return { family: "data_card", title: `Data card · ${variables.length} variables`, lines: [] };
  }
  if (table.length === 1 && isRecord(first)) {
    if (isFiniteNumber(first.rows) && isFiniteNumber(first.rounding_step)) {
      return {
        family: "table_row_count",
        title: `Row count · ~${first.rows.toLocaleString("en-US")} (rounded to ${first.rounding_step})`,
        lines: [],
      };
    }
    const bands = first.missing_bands;
    if (Array.isArray(bands) && bands.every((band) => ["lt_5", "5_20", "gt_20"].includes(band))) {
      const count = (band: string) => bands.filter((value) => value === band).length;
      return {
        family: "missingness_band",
        title: `Missing data · ${bands.length} columns: ${count("lt_5")} under 5%, ${count("5_20")} 5–20%, ${count("gt_20")} over 20%`,
        lines: [],
      };
    }
    const distribution = first.distribution;
    if (
      Array.isArray(distribution) &&
      distribution.every(
        (column) =>
          isRecord(column) &&
          typeof column.shape === "string" &&
          SHAPE_LABELS.has(column.shape) &&
          typeof column.tails === "string" &&
          TAIL_LABELS.has(column.tails),
      )
    ) {
      return {
        family: "distribution_band",
        title: `Distribution · ${distribution.length} columns`,
        lines: distribution.map(
          (column, index) => `Column ${index + 1}: ${SHAPE_LABELS.get(column.shape)}, ${TAIL_LABELS.get(column.tails)}`,
        ),
      };
    }
    if (isFiniteNumber(first.rho_hundredths) && isFiniteNumber(first.n)) {
      return {
        family: "rank_correlation",
        title: `Rank correlation · ρ = ${first.rho_hundredths / 100} (n ≈ ${first.n.toLocaleString("en-US")})`,
        lines: [],
      };
    }
  }
  return {
    family: "unknown",
    title: "Released result",
    lines: [`${table.length} ${table.length === 1 ? "table" : "tables"}`],
  };
}

export type LocalNodeState = "online" | "offline" | "revoked";
export function localNodeState(node: Pick<LocalNodeItem, "online" | "revoked">): LocalNodeState {
  if (node.revoked) return "revoked";
  return node.online ? "online" : "offline";
}
