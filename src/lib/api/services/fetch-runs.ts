import { toLlmPayload } from "@/lib/llm/settings";
import type { Charter, GateAnswer, IntentKind, ReviewMode, RunInput } from "@/lib/run-stream/contract";
import { ApiError, type ApiResult } from "@/types/api";
import { RunStatus } from "@/types/enums";

import apiService from "../core";
import { projectPath, runPath } from "../request";
import type { ListParams } from "../types";
import { firestoreRuns, type RunDoc } from "./firestore-store";

export { RunStatus } from "@/types/enums";

/** Where a run reads papers from, besides the open literature search. */
export interface RunSources {
  /** A PaperLab corpus, used as seed papers. */
  corpus_id?: string;
  /** The lab's knowledge graph of papers. */
  lab_kg?: boolean;
  sciatlas?: boolean;
  /** Read full texts (PaperFetchHub + GROBID) where a PDF is stored, instead of abstracts only. */
  fulltext?: boolean;
}

/** The body of the worker's `POST /v1/projects/:p/runs`. */
export interface CreateRunRequest {
  topic: string;
  domains?: string[];
  review_mode: ReviewMode;
  budget_usd?: number;
  llm: {
    base_url: string;
    api_key: string;
    model: string;
    role_models?: Partial<Record<"theorist" | "methodologist" | "skeptic" | "judge" | "reviewer", string>>;
  };
  sources?: RunSources;
}

/** What `GET /v1/projects/:p/runs/:r` says about a run. */
export interface RunState {
  run_id: string;
  /** `starting` while the engine container comes up; the app shows it as queued. */
  status: "starting" | "running" | "paused" | "awaiting_review" | "completed" | "failed";
  last_seq: number;
  cost_usd: number | null;
  message?: string;
}

/** The one source of a run's aim, scope and limits. It is a draft until the PI's charter settles it. */
export interface ResearchCase {
  version: number;
  status: "draft" | "settled";
  intent: { kind: IntentKind; text: string };
  /** Null only while an explore_dataset run waits for the dataset stage to propose one. */
  problem: { text: string; source: "researcher" | "dataset_proposed" } | null;
  context: string;
  constraints: string[];
  references: { citation: string; note: string }[];
  domains: string[];
  dataset_version_id: string | null;
  clarifications?: { question: string; answer: string }[];
  amendments?: { version: number; fields: string[]; reason: string; at: string }[];
}

export interface RunItem {
  id: string;
  project_id: string;
  dataset_id: string | null;
  dataset_version_id: string | null;
  dataset_version_number: number | null;
  created_by_user_id: string;
  status: RunStatus;
  auto_review: boolean;
  budget_usd: string;
  cost_usd: string;
  failure_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
  label?: string;
  /** The research problem, or "Explore dataset <name>". */
  title?: string;
  case?: ResearchCase;
  /** Optional parts of the case left empty: a hint, never a block. */
  case_gaps?: string[];
  domains?: string[];
  review_mode?: ReviewMode | null;
  /** Highest event `seq` stored for the run. */
  last_seq?: number;
  /** Set when the run is a pipeline of stages on engines; null for a Popper run. */
  pipeline_key?: string | null;
  interaction_mode?: string | null;
  /** Pipeline runs count tokens rather than dollars. */
  tokens_used?: number;
  token_budget?: number;
  /** A pipeline run's open stage. */
  current_stage?: { stage_run_id: string; stage_key: string; status: string; phase?: string | null } | null;
  /** Whether the Platform repairs the run by itself, or needs someone to act. */
  recovery?: RunRecovery | null;
}

/** The question a run answers, as the researcher wrote it; null for a run that explores a dataset. */
export const runProblem = (run: RunItem) => run.case?.problem?.text ?? null;
/** What a run is called: its problem, or the title the server gives a run without one. */
export const runTitle = (run: RunItem) => runProblem(run) ?? run.title ?? null;

export interface RunRecovery {
  state: "healing" | "needs_you" | "none";
  reason: string;
  attempt?: number | null;
  max_attempts?: number | null;
  next_try_at?: string | null;
  action?:
    | "wait"
    | "rerun"
    | "raise_budget"
    | "accept"
    | "answer_gate"
    | "redo"
    | "endorse_charter"
    | "answer_pi"
    | null;
}

/** An answer to a gate a pipeline stage opened. */
export interface StageGateAnswer {
  action: "answer" | "approve" | "comment";
  option_id?: string;
  text?: string;
  params?: Record<string, unknown>;
  /** For `comment`: what the hypotheses must answer, each anchored to the set under review. */
  findings?: Record<string, unknown>[];
}

/** Accepts a finished pipeline stage with what goes forward. */
export interface AcceptStageRequest {
  selection: { hypothesis_ids: string[] };
  note?: string;
}

/** What the worker's gate endpoint takes. */
export interface WorkerGateAnswer {
  option_id: "approve" | "drop" | "reject";
  dropped?: string[];
  note?: string;
}

export type RunListResponse = ApiResult<RunItem[]>;
export type RunDetailResponse = ApiResult<RunItem>;
/** Stored run events in `seq` order. Each one is checked by the run event reader before use. */
export type RunEventsResponse = ApiResult<unknown[]>;
export type GateAnswerResponse = ApiResult<{ gate_id: string; resolved_seq: number }>;

/** One question the run put to the PI, with its answer once it has one. */
export interface PiConsultation {
  id: string;
  kind: "charter" | "stage_review" | "stage_outcome" | "failure" | "close";
  authority: "pi" | "researcher";
  status: string;
  result: { decision?: { charter?: Charter | null; note?: string | null } | null } | null;
  failure: { code?: string; message?: string } | null;
  created_at: string;
  decided_at: string | null;
}

/** The worker's answer when it no longer has the person's key (after an engine restart). */
export const LLM_KEY_REQUIRED = "LLM_KEY_REQUIRED";

/** The pipeline the i2h engine runs: every run from the worker is one. */
export const I2H_PIPELINE = "idea2hypothesis";

const ok = <T>(data: T, total?: number): ApiResult<T> => ({
  success: true,
  message: "OK",
  data,
  meta: {
    request_id: "",
    pagination: total === undefined ? null : { total, limit: total, offset: 0 },
  },
});

const notSupported = (what: string) =>
  new ApiError(501, "NOT_SUPPORTED", `${what} isn't available with the i2h engine yet.`);

const STATUSES = new Set<string>(Object.values(RunStatus));
export function toRunStatus(status: string | null | undefined): RunStatus {
  return status && STATUSES.has(status) ? (status as RunStatus) : RunStatus.Queued;
}

/** A run as the app shows it: its Firestore document, with what the worker says about it when known. */
export function toRunItem(projectId: string, id: string, doc: RunDoc, state?: RunState): RunItem {
  const status = toRunStatus(state?.status ?? doc.status);
  const finished = [RunStatus.Completed, RunStatus.Failed, RunStatus.Stopped].includes(status);
  return {
    id,
    project_id: projectId,
    dataset_id: null,
    dataset_version_id: null,
    dataset_version_number: null,
    created_by_user_id: doc.createdBy,
    status,
    auto_review: doc.review_mode === "auto",
    budget_usd: "0",
    cost_usd: String(state?.cost_usd ?? 0),
    failure_message: status === RunStatus.Failed ? (state?.message ?? null) : null,
    created_at: doc.createdAt,
    started_at: doc.createdAt,
    finished_at: finished ? doc.updatedAt : null,
    updated_at: doc.updatedAt,
    title: doc.topic,
    case: {
      version: 1,
      status: "settled",
      intent: { kind: "explain", text: doc.topic },
      problem: { text: doc.topic, source: "researcher" },
      context: "",
      constraints: [],
      references: [],
      domains: doc.domains ?? [],
      dataset_version_id: null,
    },
    domains: doc.domains ?? [],
    review_mode: doc.review_mode,
    ...(state ? { last_seq: state.last_seq } : {}),
    pipeline_key: I2H_PIPELINE,
    current_stage: null,
    recovery: null,
  };
}

/** Maps the run studio's answer onto the worker's three options. */
export function toWorkerGateAnswer(answer: GateAnswer): WorkerGateAnswer {
  const rejected = ["reject", "stop", "abandon", "cancel"].includes(answer.option_id);
  const dropped = answer.dropped?.filter(Boolean) ?? [];
  const note = answer.note?.trim();
  let option: WorkerGateAnswer["option_id"] = dropped.length ? "drop" : "approve";
  if (rejected) option = "reject";
  return {
    option_id: option,
    ...(!rejected && dropped.length ? { dropped } : {}),
    ...(note ? { note } : {}),
  };
}

/** The body of a start: the run studio's input, the language model and the sources. */
export function toCreateRunRequest(
  input: RunInput,
  mode: ReviewMode,
  llm: CreateRunRequest["llm"],
  sources?: RunSources,
  budgetUsd?: number,
): CreateRunRequest {
  const chosen = Object.entries(sources ?? {}).filter(([, value]) => value !== undefined && value !== false);
  return {
    topic: input.problem.trim(),
    ...(input.domains.length ? { domains: input.domains } : {}),
    review_mode: mode,
    ...(budgetUsd ? { budget_usd: budgetUsd } : {}),
    llm,
    ...(chosen.length ? { sources: Object.fromEntries(chosen) as RunSources } : {}),
  };
}

async function getState(projectId: string, runId: string, signal?: AbortSignal): Promise<RunState> {
  const response = await apiService.get<RunState>(`${runPath(projectId, runId)}`, undefined, { signal });
  return response.data;
}

async function detail(projectId: string, runId: string, signal?: AbortSignal): Promise<RunDetailResponse> {
  const [doc, state] = await Promise.all([firestoreRuns.get(projectId, runId), getState(projectId, runId, signal)]);
  if (!doc) throw new ApiError(404, "NOT_FOUND", "This run no longer exists.");
  // The worker is the run's truth; the document keeps the list in step for everyone else.
  if (state.status !== doc.status) {
    firestoreRuns.setStatus(projectId, runId, state.status).catch(() => {
      // Shown from the worker either way; the list catches up on the next read.
    });
  }
  return ok(toRunItem(projectId, runId, doc, state));
}

async function control(projectId: string, runId: string, action: "pause" | "cancel" | "resume", body?: unknown) {
  await apiService.post(`${runPath(projectId, runId)}/${action}`, body ?? {});
  return detail(projectId, runId);
}

export const fetchRuns = {
  /** The project's runs, newest first, from Firestore. */
  getList: async (projectId: string, params?: ListParams, _signal?: AbortSignal): Promise<RunListResponse> => {
    const runs = await firestoreRuns.list(projectId, params?.limit);
    return ok(
      runs.map(({ id, doc }) => toRunItem(projectId, id, doc)),
      runs.length,
    );
  },
  getById: detail,
  /** The worker's view of a run: status, last event and cost. */
  getState,
  /** Starts a run on the worker, then records it in Firestore so the project lists it. */
  create: async (projectId: string, data: CreateRunRequest, createdBy: string): Promise<RunDetailResponse> => {
    const response = await apiService.post<{ run_id: string; status: string }>(`${projectPath(projectId)}/runs`, data);
    const { run_id: runId, status } = response.data;
    const doc = await firestoreRuns.create(projectId, runId, {
      topic: data.topic,
      review_mode: data.review_mode,
      status: toRunStatus(status),
      createdBy,
      domains: data.domains ?? [],
    });
    return ok(toRunItem(projectId, runId, doc));
  },
  /** Keeps the run's document in step with a status the stream reported. */
  recordStatus: (projectId: string, runId: string, status: RunStatus) =>
    firestoreRuns.setStatus(projectId, runId, status),
  /** Asks the worker where the run is: for a run that looks stuck. */
  sync: (projectId: string, runId: string) => detail(projectId, runId),
  /** Cancels the run; it ends as stopped. */
  stop: (projectId: string, runId: string) => control(projectId, runId, "cancel"),
  abandon: (projectId: string, runId: string) => control(projectId, runId, "cancel"),
  pause: (projectId: string, runId: string) => control(projectId, runId, "pause"),
  /** The worker never stores the key, so resuming sends the language model again. */
  resume: (projectId: string, runId: string, llm: CreateRunRequest["llm"]) =>
    control(projectId, runId, "resume", { llm }),
  /** Picks a failed run up again from its last checkpoint. */
  rerunStage: (projectId: string, runId: string, _stageRunId: string, llm: CreateRunRequest["llm"]) =>
    control(projectId, runId, "resume", { llm }),
  raiseBudget: async (_projectId: string, _runId: string, _tokenBudget: number): Promise<RunDetailResponse> => {
    throw notSupported("Raising a run's budget");
  },
  getEvents: async (
    projectId: string,
    runId: string,
    params: { after: number; limit: number },
    signal?: AbortSignal,
  ): Promise<RunEventsResponse> => {
    const response = await apiService.get<{ events: unknown[] }>(
      `${runPath(projectId, runId)}/events`,
      { ...params, format: "json" },
      { signal },
    );
    return ok(response.data.events ?? []);
  },
  /**
   * Answers a gate. After an engine restart the worker no longer has the key and answers 503 `LLM_KEY_REQUIRED`: the
   * answer then goes again with the language model from Settings. The key is not sent when it isn't needed.
   */
  answerGate: async (projectId: string, runId: string, gateId: string, answer: GateAnswer) => {
    const path = `${runPath(projectId, runId)}/gates/${encodeURIComponent(gateId)}`;
    const body = toWorkerGateAnswer(answer);
    const send = (extra?: { llm: CreateRunRequest["llm"] }) =>
      apiService.post<{ gate_id?: string; resolved_seq?: number }>(path, { ...body, ...extra });
    let response: Awaited<ReturnType<typeof send>>;
    try {
      response = await send();
    } catch (error) {
      if (!(error instanceof ApiError && error.code === LLM_KEY_REQUIRED)) throw error;
      response = await send({ llm: toLlmPayload() });
    }
    return ok({ gate_id: response.data?.gate_id ?? gateId, resolved_seq: response.data?.resolved_seq ?? 0 });
  },
  /** The engine has no PI consultations: a charter is settled by the scope gate. */
  getConsultations: async (
    _projectId: string,
    _runId: string,
    _signal?: AbortSignal,
  ): Promise<ApiResult<PiConsultation[]>> => ok([]),
};
