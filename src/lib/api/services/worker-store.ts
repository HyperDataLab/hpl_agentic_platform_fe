import type { ReviewMode } from "@/lib/run-stream/contract";

import apiService from "../core";
import { projectPath, runPath } from "../request";

/** A project as the i2h-worker keeps it in D1. Emails are lower case. */
export interface WorkerProject {
  id: string;
  name: string;
  description: string;
  owner_email: string;
  member_emails: string[];
  status: "researching" | "completed" | "archived";
  created_at: string;
  updated_at: string;
}

/** A run in the project's run list (D1), with the worker's live state when it was read through the run itself. */
export interface WorkerRun {
  run_id: string;
  project_id?: string;
  topic?: string;
  review_mode?: ReviewMode;
  domains?: string[];
  /** `starting`, `running`, `paused`, `awaiting_review`, `completed` or `failed`. */
  status: string;
  message?: string | null;
  last_seq: number;
  /** A number in the list, a decimal string from the engine's live state, or null. */
  cost_usd: number | string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectFields {
  name?: string;
  description?: string;
  status?: WorkerProject["status"];
  owner_email?: string;
}

/** Projects, members and run lists, all kept by the i2h-worker in Cloudflare D1. */
export const workerProjects = {
  list: async (signal?: AbortSignal) =>
    (await apiService.get<{ projects: WorkerProject[] }>("/projects", undefined, { signal })).data.projects,
  get: async (id: string, signal?: AbortSignal) =>
    (await apiService.get<WorkerProject>(projectPath(id), undefined, { signal })).data,
  create: async (input: { name: string; description: string }) =>
    (await apiService.post<WorkerProject>("/projects", input)).data,
  update: async (id: string, fields: ProjectFields) =>
    (await apiService.patch<WorkerProject>(projectPath(id), fields)).data,
  remove: async (id: string) => {
    await apiService.delete(projectPath(id));
  },
  addMember: async (id: string, email: string) =>
    (await apiService.post<WorkerProject>(`${projectPath(id)}/members`, { email })).data,
  removeMember: async (id: string, email: string) =>
    (await apiService.delete<WorkerProject>(`${projectPath(id)}/members/${encodeURIComponent(email)}`)).data,
};

export const workerRuns = {
  list: async (projectId: string, limit?: number, signal?: AbortSignal) =>
    (
      await apiService.get<{ runs: WorkerRun[] }>(`${projectPath(projectId)}/runs`, limit ? { limit } : undefined, {
        signal,
      })
    ).data.runs,
  /** The run's live state and its record. */
  get: async (projectId: string, runId: string, signal?: AbortSignal) =>
    (await apiService.get<WorkerRun>(runPath(projectId, runId), undefined, { signal })).data,
};
