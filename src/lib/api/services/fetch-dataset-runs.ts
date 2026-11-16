import { fetchArtifacts } from "./fetch-artifacts";
import type { RunItem } from "./fetch-runs";

export const DATA_CARD_SCHEMA = "dataset.data_card/v1";
export const BRIEF_SCHEMA = "dataset.brief/v2";

export interface DataCardVariable {
  name: string;
  type: "numeric" | "string" | "date";
  measure: "nominal" | "ordinal" | "scale" | "count";
  role: "input" | "target" | "both" | "none" | "partition" | "split";
  kind?: "single" | "multi_response" | "free_text" | "identifier";
  label?: string | null;
  summary: {
    n_valid: number | null;
    n_missing: number | null;
    n_distinct?: number | null;
    mean?: number | null;
    sd?: number | null;
  };
  flags: string[];
}

/** `dataset.data_card/v1`: aggregates only, never a row. */
export interface DataCardBody {
  title: string;
  description?: string | null;
  unit_of_observation?: string | null;
  n_rows: number;
  n_columns: number;
  min_cell?: number;
  variables: DataCardVariable[];
  caveats?: string[];
  gaps?: string[];
  disclosure?: "standard" | "strict" | null;
}

/** `dataset.brief/v2`: the questions the data can answer. */
export interface DatasetBriefBody {
  questions: { id: string; text: string; variables: string[]; rationale?: string | null; n_complete?: number | null }[];
  chosen?: { question_id: string; text: string } | null;
  domains?: string[];
}

export const datasetRunKeys = {
  outputs: (projectId: string, runId: string) =>
    ["projects", "detail", projectId, "runs", runId, "dataset-outputs"] as const,
};

/** The project's runs that belong to one dataset version, newest first. The list has no server filter. */
export function runsOfVersion(runs: RunItem[], versionId: string | undefined): RunItem[] {
  if (!versionId) return [];
  return runs.filter((run) => run.dataset_version_id === versionId);
}

async function readJson<T>(projectId: string, runId: string, schema: string, signal?: AbortSignal): Promise<T | null> {
  const list = await fetchArtifacts.getBySchema(projectId, runId, schema, signal);
  const artifact = list.data.find((item) => item.primary) ?? list.data[0];
  if (!artifact) return null;
  const file = await fetchArtifacts.download(projectId, runId, artifact.id, signal);
  return JSON.parse(await file.blob.text()) as T;
}

export const fetchDatasetRuns = {
  /** The Dataset stage's outputs of one run; each is null until the stage has published it. */
  outputs: async (projectId: string, runId: string, signal?: AbortSignal) => ({
    card: await readJson<DataCardBody>(projectId, runId, DATA_CARD_SCHEMA, signal),
    brief: await readJson<DatasetBriefBody>(projectId, runId, BRIEF_SCHEMA, signal),
  }),
};
