import { z } from "zod";

import { authorizedFetch, runPath } from "@/lib/api/request";
import { fetchRuns } from "@/lib/api/services/fetch-runs";
import { SESSION_INVALID_CODES } from "@/lib/auth/auth-config";
import type { RunEvent } from "@/lib/run-stream/contract";
import { ApiError } from "@/types/api";

import { readSse, type SseMessage } from "./sse";

const PAGE = 500;

// Only the envelope is checked here. The backend validates every payload against the contract before storing it.
const envelopeSchema = z.object({
  seq: z.number().int().positive(),
  run_id: z.string(),
  ts: z.string(),
  type: z.string(),
  stage_key: z.string().nullish(),
  actor: z.string().nullish(),
  payload: z.record(z.string(), z.unknown()),
  // Pipeline runs: the stage run, the engine's step and phase the event belongs to.
  stage_run_id: z.string().nullish(),
  step_key: z.string().nullish(),
  phase: z.string().nullish(),
  // A line the backend wrote about the event, such as the PI's reasoning for a decision.
  summary: z.string().nullish(),
});

/** Reads one stored event. Returns null when it is not a run event. */
export function parseRunEvent(value: unknown): RunEvent | null {
  const parsed = envelopeSchema.safeParse(value);
  if (!parsed.success) return null;
  const { stage_key, actor, stage_run_id, step_key, phase, summary, ...rest } = parsed.data;
  return {
    ...rest,
    ...(stage_key ? { stage_key } : {}),
    ...(actor ? { actor } : {}),
    ...(stage_run_id ? { stage_run_id } : {}),
    ...(step_key ? { step_key } : {}),
    ...(phase ? { phase } : {}),
    ...(summary ? { summary } : {}),
  } as RunEvent;
}

/** `history`: already stored when the page opened. `live`: happened while following (or while reconnecting). */
export type RunEventOrigin = "history" | "live";

interface RunEventHandlers {
  /** New events in `seq` order. An event is never delivered twice. */
  onEvents: (events: RunEvent[], origin: RunEventOrigin) => void;
  /** The run finished and every event was delivered. */
  onEnded: () => void;
  onSessionEnded: (code: string) => void;
  onError: (error: Error) => void;
}

/** Run statuses after which nothing more happens. */
const FINISHED = new Set(["completed", "failed", "stopped", "budget_exceeded"]);

/**
 * Follows a run: reads every stored event after `after`, then streams new ones while the run is `live`.
 * After a dropped connection it reads what it missed and reconnects.
 *
 * The worker's stream (`GET …/events?after=N`) sends each event as `id: <seq>` and `data: <envelope>`. It is read with
 * `fetch`, because `EventSource` cannot send the `Authorization` header. When the worker closes the stream, the run's
 * state says whether it ended or the stream should be picked up again.
 */
export function subscribeRunEvents(
  projectId: string,
  runId: string,
  options: { after: number; live: boolean },
  handlers: RunEventHandlers,
) {
  let stream: AbortController | null = null;
  let disposed = false;
  let syncing = false;
  let lastSeq = options.after;
  let attempt = 0;
  // Until the stream has been open once, what the backend returns is the run's history.
  let followed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  const closeStream = () => {
    stream?.abort();
    stream = null;
  };
  const stop = () => {
    disposed = true;
    controller.abort();
    clearTimeout(timer);
    closeStream();
  };
  const deliver = (events: RunEvent[], origin: RunEventOrigin) => {
    const fresh = events.filter((event) => event.seq > lastSeq);
    if (!fresh.length) return;
    lastSeq = fresh[fresh.length - 1].seq;
    handlers.onEvents(fresh, origin);
  };
  const catchUp = async () => {
    for (;;) {
      const page = await fetchRuns.getEvents(projectId, runId, { after: lastSeq, limit: PAGE }, controller.signal);
      if (disposed) return;
      const events = page.data.map(parseRunEvent);
      if (events.some((event) => event === null)) throw new Error("Unable to read the run's progress.");
      deliver(events as RunEvent[], followed ? "live" : "history");
      if (page.data.length < PAGE) return;
    }
  };
  const retry = (seconds?: number) => {
    closeStream();
    clearTimeout(timer);
    const delay = seconds ?? [1, 2, 5, 10, 30][Math.min(attempt++, 4)];
    timer = setTimeout(() => void sync(), delay * 1000);
  };
  const fail = (error: unknown) => {
    if (disposed) return;
    if (error instanceof ApiError && SESSION_INVALID_CODES.includes(error.code)) {
      stop();
      handlers.onSessionEnded(error.code);
    } else if (error instanceof ApiError && [403, 404].includes(error.status)) {
      stop();
      handlers.onError(error);
    } else {
      // Only the first failure is reported; the retries after it stay quiet.
      if (attempt === 0) handlers.onError(error instanceof Error ? error : new Error("Lost the run's progress."));
      retry(error instanceof ApiError && error.code === "RATE_LIMITED" ? (error.retryAfter ?? 60) : undefined);
    }
  };
  // Reads what was missed, then connects the stream. Errors that cannot heal end the subscription.
  const sync = async () => {
    if (disposed || syncing) return;
    syncing = true;
    try {
      await catchUp();
      if (disposed) return;
      if (options.live) void connect();
      else {
        stop();
        handlers.onEnded();
      }
    } catch (error) {
      fail(error);
    } finally {
      syncing = false;
    }
  };
  const receive = (message: SseMessage, current: AbortController) => {
    if (disposed || stream !== current) return;
    if (message.event === "run-ended") {
      stop();
      handlers.onEnded();
      return;
    }
    if (message.event === "session-ended") {
      let code = "UNAUTHENTICATED";
      try {
        code = z.object({ code: z.string() }).parse(JSON.parse(message.data)).code;
      } catch {
        /* Closing is still right when the reason can't be read. */
      }
      stop();
      handlers.onSessionEnded(code);
      return;
    }
    if (message.event !== "message" && message.event !== "run-event") return;
    let event: RunEvent | null = null;
    try {
      event = parseRunEvent(JSON.parse(message.data));
    } catch {
      event = null;
    }
    // Events the stream replays before it opened are still the history.
    if (event) deliver([event], followed ? "live" : "history");
    else {
      handlers.onError(new Error("Unable to read the run's progress. Reconnecting."));
      retry();
    }
  };
  // The worker closed the stream: the run ended, or the connection should be picked up again.
  const closed = async () => {
    try {
      const state = await fetchRuns.getState(projectId, runId, controller.signal);
      if (disposed) return;
      if (FINISHED.has(state.status) && state.last_seq <= lastSeq) {
        stop();
        handlers.onEnded();
        return;
      }
    } catch (error) {
      if (disposed) return;
      if (
        error instanceof ApiError &&
        (SESSION_INVALID_CODES.includes(error.code) || [403, 404].includes(error.status))
      )
        return fail(error);
    }
    retry();
  };
  const connect = async () => {
    const current = new AbortController();
    stream = current;
    try {
      const response = await authorizedFetch(
        `${runPath(projectId, runId)}/events?${new URLSearchParams({ after: String(lastSeq) })}`,
        {
          headers: { Accept: "text/event-stream", "Last-Event-ID": String(lastSeq) },
          signal: current.signal,
          cache: "no-store",
        },
      );
      if (disposed || stream !== current) return;
      if (!response.ok || !response.body) {
        const codes: Record<number, string> = { 401: "UNAUTHENTICATED", 429: "RATE_LIMITED" };
        const code = codes[response.status] ?? "HTTP";
        const retryAfter = Number(response.headers.get("retry-after"));
        throw new ApiError(
          response.status,
          code,
          response.status === 404 ? "This run no longer exists." : "Lost the run's progress.",
          [],
          null,
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
        );
      }
      attempt = 0;
      followed = true;
      await readSse(response.body, (message) => receive(message, current), current.signal);
      if (disposed || stream !== current) return;
      await closed();
    } catch (error) {
      if (disposed || stream !== current || current.signal.aborted) return;
      // A stream refused with 401 or 404 never comes back; anything else is read again from where it broke.
      if (error instanceof ApiError) fail(error);
      else retry();
    }
  };
  void sync();
  return stop;
}
