import type { ApiResult } from "@/types/api";

import { connectionRequest } from "../connection-runtime";
import apiService from "../core";
import { downloadUrl, projectPath, requestDownload } from "../request";
import type { FileDownload, ListParams } from "../types";
import type { ConnectionKind, ConnectionSource } from "./fetch-data-connections";

/** Rounded profile released by a Local Node; withheld statistics remain null. */
export interface LocalCard {
  variables: {
    name: string;
    type: "numeric" | "string" | "date";
    measure: "nominal" | "ordinal" | "scale" | "count";
    kind: "single" | "multi_response" | "free_text" | "identifier";
    role: "input" | "target" | "both" | "none" | "partition" | "split";
    summary: {
      n_valid: number | null;
      n_missing: number | null;
      n_distinct: number | null;
      mean: number | null;
      sd: number | null;
    };
    flags: string[];
  }[];
  n_rows: number;
  split: {
    method: "random_rows" | "by_unit";
    unit_column: string | null;
    seed: number;
    exploration_fraction: number;
    n_exploration: number;
    n_confirmation: number;
    mask_sha256: string | null;
  };
  report: { gaps: string[] };
  disclosure: "standard" | "strict";
}

export interface DatasetVersionItem {
  id: string;
  dataset_id: string;
  version_number: number;
  superseded_by_version?: number | null;
  original_filename: string;
  size_bytes: number;
  sha256: string;
  row_count: number;
  column_names: string[];
  source_type: "upload" | "connection";
  source: {
    connection_id: string;
    connection_name: string;
    connection_kind: ConnectionKind;
    source: ConnectionSource;
    fetched_at: string;
  } | null;
  /** `local`: the file stays on a Local Node; only metadata is on the Platform. */
  storage?: "platform" | "local";
  disclosure?: "standard" | "strict";
  runner_id?: string | null;
  local_card?: LocalCard | null;
  created_by_user_id: string;
  created_at: string;
}

/** A version whose rows stay on a Local Node: no preview or download exists on the Platform. */
export function isLocalVersion(version: Pick<DatasetVersionItem, "storage"> | null | undefined): boolean {
  return version?.storage === "local";
}

export interface DatasetItem {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  latest_version: DatasetVersionItem | null;
}

export interface CreateDatasetRequest {
  name: string;
  description?: string;
  file: File;
}

export interface UpdateDatasetRequest {
  name?: string;
  description?: string | null;
}

export interface ImportConnectionSource {
  connection_id: string;
  source: ConnectionSource;
}
export interface ImportConnectionDatasetRequest extends ImportConnectionSource {
  name: string;
  description?: string;
}

export type DatasetListResponse = ApiResult<DatasetItem[]>;
export type DatasetDetailResponse = ApiResult<DatasetItem>;
export type DatasetUploadOutcome = "created_dataset" | "created_version" | "created_copy";
export type DatasetUploadResponse = DatasetDetailResponse & {
  meta: DatasetDetailResponse["meta"] & {
    upload: { outcome: DatasetUploadOutcome; dataset_id: string; version_id: string };
  };
};
export interface DatasetPreviewData {
  dataset_id: string;
  version_id: string;
  columns: string[];
  rows: string[][];
  truncated: boolean;
  masking_applied: boolean;
  masked_cells: number;
  detection_status: "ready" | "off";
}
export type DatasetVersionListResponse = ApiResult<DatasetVersionItem[]>;
export type DatasetVersionDetailResponse = ApiResult<DatasetVersionItem>;

const datasetsPath = (projectId: string) => `${projectPath(projectId)}/datasets`;
const datasetPath = (projectId: string, datasetId: string) =>
  `${datasetsPath(projectId)}/${encodeURIComponent(datasetId)}`;
const versionDownloadPath = (projectId: string, datasetId: string, versionId: string) =>
  `${datasetPath(projectId, datasetId)}/versions/${encodeURIComponent(versionId)}/download`;

export const fetchDatasets = {
  importConnection: (projectId: string, input: ImportConnectionDatasetRequest): Promise<DatasetUploadResponse> =>
    connectionRequest(
      projectId,
      async () =>
        (
          await apiService.post<DatasetUploadResponse>(`${datasetsPath(projectId)}/from-connection`, input, {
            timeout: 330_000,
          })
        ).data,
      undefined,
      input.connection_id,
    ),
  importConnectionVersion: (
    projectId: string,
    datasetId: string,
    input: ImportConnectionSource,
  ): Promise<DatasetVersionDetailResponse> =>
    connectionRequest(
      projectId,
      async () =>
        (
          await apiService.post<DatasetVersionDetailResponse>(
            `${datasetPath(projectId, datasetId)}/versions/from-connection`,
            input,
            { timeout: 330_000 },
          )
        ).data,
      undefined,
      input.connection_id,
    ),
  getList: async (projectId: string, params?: ListParams, signal?: AbortSignal): Promise<DatasetListResponse> => {
    const response = await apiService.get<DatasetListResponse>(datasetsPath(projectId), params, { signal });
    return response.data;
  },
  getById: async (projectId: string, datasetId: string, signal?: AbortSignal): Promise<DatasetDetailResponse> => {
    const response = await apiService.get<DatasetDetailResponse>(datasetPath(projectId, datasetId), undefined, {
      signal,
    });
    return response.data;
  },
  create: async (
    projectId: string,
    data: CreateDatasetRequest,
    onProgress?: (progress: number) => void,
  ): Promise<DatasetUploadResponse> => {
    const form = new FormData();
    form.append("name", data.name);
    if (data.description !== undefined) form.append("description", data.description);
    form.append("file", data.file);
    const response = await apiService.upload<DatasetUploadResponse>(datasetsPath(projectId), form, onProgress);
    return response.data;
  },
  update: async (projectId: string, datasetId: string, data: UpdateDatasetRequest): Promise<DatasetDetailResponse> => {
    const response = await apiService.patch<DatasetDetailResponse>(datasetPath(projectId, datasetId), data);
    return response.data;
  },
  getVersions: async (
    projectId: string,
    datasetId: string,
    params?: ListParams,
    signal?: AbortSignal,
  ): Promise<DatasetVersionListResponse> => {
    const response = await apiService.get<DatasetVersionListResponse>(
      `${datasetPath(projectId, datasetId)}/versions`,
      params,
      { signal },
    );
    return response.data;
  },
  createVersion: async (
    projectId: string,
    datasetId: string,
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<DatasetVersionDetailResponse> => {
    const form = new FormData();
    form.append("file", file);
    const response = await apiService.upload<DatasetVersionDetailResponse>(
      `${datasetPath(projectId, datasetId)}/versions`,
      form,
      onProgress,
    );
    return response.data;
  },
  downloadVersion: (
    projectId: string,
    datasetId: string,
    versionId: string,
    signal?: AbortSignal,
  ): Promise<FileDownload> => requestDownload(versionDownloadPath(projectId, datasetId, versionId), signal),
  /** Refused with `DATASET_IN_USE` (409) once a research run has used the dataset. */
  remove: async (projectId: string, datasetId: string): Promise<ApiResult<null>> => {
    const response = await apiService.delete<ApiResult<null>>(datasetPath(projectId, datasetId));
    return response.data;
  },
  getVersionDownloadUrl: (projectId: string, datasetId: string, versionId: string): string =>
    downloadUrl(versionDownloadPath(projectId, datasetId, versionId)),
  preview: async (projectId: string, datasetId: string, versionId: string, signal?: AbortSignal) => {
    const response = await apiService.get<ApiResult<DatasetPreviewData>>(
      `${datasetPath(projectId, datasetId)}/versions/${encodeURIComponent(versionId)}/preview`,
      { limit: 100 },
      { signal },
    );
    return response.data;
  },
};
