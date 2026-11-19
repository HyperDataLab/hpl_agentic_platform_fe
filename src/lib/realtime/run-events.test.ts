import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchRuns } from "@/lib/api/services/fetch-runs";
import { ApiError } from "@/types/api";

import { parseRunEvent, subscribeRunEvents } from "./run-events";

vi.mock("@/lib/firebase/client", () => ({ getIdToken: async () => "id-token" }));

/** One `fetch` of the worker's stream: the test writes server-sent events into it and closes it. */
class FakeStream {
  static instances: FakeStream[] = [];
  controller!: ReadableStreamDefaultController<Uint8Array>;
  readonly body: ReadableStream<Uint8Array>;
  aborted = false;
  constructor(
    public url: string,
    public init: RequestInit,
  ) {
    this.body = new ReadableStream({ start: (controller) => void (this.controller = controller) });
    init.signal?.addEventListener("abort", () => {
      this.aborted = true;
    });
    FakeStream.instances.push(this);
  }
  emit(payload: unknown, event?: string) {
    const lines = [...(event ? [`event: ${event}`] : []), `data: ${JSON.stringify(payload)}`];
    const id = (payload as { seq?: number }).seq;
    if (id) lines.unshift(`id: ${id}`);
    this.controller.enqueue(new TextEncoder().encode(`${lines.join("\n")}\n\n`));
  }
  close() {
    this.controller.close();
  }
  fail() {
    this.controller.error(new TypeError("network error"));
  }
  header(name: string) {
    return new Headers(this.init.headers).get(name);
  }
}

let refuse: number | null = null;
const fetchStub = vi.fn(async (url: string, init: RequestInit) => {
  if (refuse) return new Response(null, { status: refuse });
  const stream = new FakeStream(url, init);
  return new Response(stream.body, { status: 200, headers: { "content-type": "text/event-stream" } });
});

const event = (seq: number, type = "agent.message") => ({
  seq,
  run_id: "run-1",
  ts: "2026-10-06T07:45:59.000Z",
  type,
  stage_key: "scope",
  actor: "strategist",
  payload: { message_id: "m1", delta: "Hi " },
});
const page = (events: unknown[]) =>
  ({
    success: true,
    message: "OK",
    data: events,
    meta: { request_id: "r", pagination: { total: events.length, limit: 500, offset: 0 } },
  }) as Awaited<ReturnType<typeof fetchRuns.getEvents>>;
const handlers = () => ({ onEvents: vi.fn(), onEnded: vi.fn(), onSessionEnded: vi.fn(), onError: vi.fn() });
const seqs = (calls: unknown[][]) => calls.flatMap(([events]) => (events as { seq: number }[]).map((e) => e.seq));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("run event subscription", () => {
  beforeEach(() => {
    FakeStream.instances = [];
    refuse = null;
    fetchStub.mockClear();
    vi.stubGlobal("fetch", fetchStub);
    vi.stubGlobal("window", { location: { origin: "https://frontend.test" } });
    vi.stubEnv("NEXT_PUBLIC_I2H_WORKER_URL", "https://worker.test");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("reads stored events first, then streams from the last one with the ID token", async () => {
    const getEvents = vi.spyOn(fetchRuns, "getEvents").mockResolvedValueOnce(page([event(1), event(2)]));
    const listener = handlers();
    subscribeRunEvents("project/1", "run-1", { after: 0, live: true }, listener);
    await vi.waitFor(() => expect(FakeStream.instances).toHaveLength(1));
    expect(getEvents).toHaveBeenCalledWith("project/1", "run-1", { after: 0, limit: 500 }, expect.any(AbortSignal));
    const stream = FakeStream.instances[0];
    const url = new URL(stream.url);
    expect(url.origin).toBe("https://worker.test");
    expect(url.pathname).toBe("/v1/projects/project%2F1/runs/run-1/events");
    expect(url.searchParams.get("after")).toBe("2");
    expect(stream.header("Authorization")).toBe("Bearer id-token");
    expect(stream.header("Last-Event-ID")).toBe("2");
    expect(stream.header("Accept")).toBe("text/event-stream");
    stream.emit(event(2));
    stream.emit(event(3));
    await vi.waitFor(() => expect(seqs(listener.onEvents.mock.calls)).toEqual([1, 2, 3]));
    stream.emit({ status: "completed" }, "run-ended");
    await vi.waitFor(() => expect(listener.onEnded).toHaveBeenCalledOnce());
    expect(stream.aborted).toBe(true);
  });

  it("ends when the worker closes the stream of a finished run", async () => {
    vi.spyOn(fetchRuns, "getEvents").mockResolvedValueOnce(page([event(1)]));
    const getState = vi
      .spyOn(fetchRuns, "getState")
      .mockResolvedValue({ run_id: "run-1", status: "completed", last_seq: 2, cost_usd: 0.1 });
    const listener = handlers();
    subscribeRunEvents("p", "run-1", { after: 0, live: true }, listener);
    await vi.waitFor(() => expect(FakeStream.instances).toHaveLength(1));
    FakeStream.instances[0].emit(event(2));
    FakeStream.instances[0].close();
    await vi.waitFor(() => expect(listener.onEnded).toHaveBeenCalledOnce());
    expect(getState).toHaveBeenCalledOnce();
    expect(seqs(listener.onEvents.mock.calls)).toEqual([1, 2]);
    expect(FakeStream.instances).toHaveLength(1);
  });

  it("only reads a run that is no longer live", async () => {
    vi.spyOn(fetchRuns, "getEvents").mockResolvedValueOnce(page([event(1)]));
    const listener = handlers();
    subscribeRunEvents("p", "run-1", { after: 0, live: false }, listener);
    await vi.waitFor(() => expect(listener.onEnded).toHaveBeenCalledOnce());
    expect(listener.onEvents).toHaveBeenCalledOnce();
    expect(FakeStream.instances).toHaveLength(0);
  });

  it("after a dropped stream, reads what it missed and reconnects from there", async () => {
    vi.useFakeTimers();
    const getEvents = vi
      .spyOn(fetchRuns, "getEvents")
      .mockResolvedValueOnce(page([event(1)]))
      .mockResolvedValueOnce(page([event(2), event(3)]));
    const listener = handlers();
    subscribeRunEvents("p", "run-1", { after: 0, live: true }, listener);
    await vi.waitFor(() => expect(FakeStream.instances).toHaveLength(1));
    FakeStream.instances[0].fail();
    await vi.waitFor(() => expect(FakeStream.instances[0].aborted).toBe(true));
    await vi.advanceTimersByTimeAsync(1000);
    expect(getEvents).toHaveBeenLastCalledWith("p", "run-1", { after: 1, limit: 500 }, expect.any(AbortSignal));
    await vi.waitFor(() => expect(FakeStream.instances).toHaveLength(2));
    expect(new URL(FakeStream.instances[1].url).searchParams.get("after")).toBe("3");
    // The new stream replays from its cursor; nothing is delivered twice.
    FakeStream.instances[1].emit(event(3));
    FakeStream.instances[1].emit(event(4));
    await vi.waitFor(() => expect(seqs(listener.onEvents.mock.calls)).toEqual([1, 2, 3, 4]));
  });

  it("ends on session-ended, on a stream refused with 401, and on a run the person can no longer see", async () => {
    vi.spyOn(fetchRuns, "getEvents").mockResolvedValue(page([]));
    const listener = handlers();
    subscribeRunEvents("p", "run-1", { after: 0, live: true }, listener);
    await vi.waitFor(() => expect(FakeStream.instances).toHaveLength(1));
    FakeStream.instances[0].emit({ code: "SESSION_EXPIRED" }, "session-ended");
    await vi.waitFor(() => expect(listener.onSessionEnded).toHaveBeenCalledWith("SESSION_EXPIRED"));

    refuse = 401;
    const refused = handlers();
    subscribeRunEvents("p", "run-3", { after: 0, live: true }, refused);
    await vi.waitFor(() => expect(refused.onSessionEnded).toHaveBeenCalledWith("UNAUTHENTICATED"));

    refuse = null;
    vi.spyOn(fetchRuns, "getEvents").mockRejectedValueOnce(new ApiError(404, "NOT_FOUND", "Run not found"));
    const gone = handlers();
    subscribeRunEvents("p", "run-2", { after: 0, live: true }, gone);
    await vi.waitFor(() => expect(gone.onError).toHaveBeenCalledOnce());
    await flush();
    expect(FakeStream.instances).toHaveLength(1);
  });

  it("drops null stage and actor and rejects what is not an event", () => {
    expect(parseRunEvent({ ...event(4), stage_key: null, actor: null })).toEqual({
      seq: 4,
      run_id: "run-1",
      ts: "2026-10-06T07:45:59.000Z",
      type: "agent.message",
      payload: { message_id: "m1", delta: "Hi " },
    });
    expect(parseRunEvent({ seq: 0, type: "x" })).toBeNull();
  });
});
