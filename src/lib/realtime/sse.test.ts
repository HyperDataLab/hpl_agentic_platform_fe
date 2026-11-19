import { describe, expect, it } from "vitest";

import { readSse, type SseMessage, SseParser } from "./sse";

const stream = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });

describe("SSE parser", () => {
  it("reads the worker's events: id, data and the default event name", () => {
    const parser = new SseParser();
    expect(parser.push('id: 1\ndata: {"seq":1}\n\nid: 2\ndata: {"seq":2}\n\n')).toEqual([
      { event: "message", data: '{"seq":1}', id: "1" },
      { event: "message", data: '{"seq":2}', id: "2" },
    ]);
  });

  it("joins data lines, keeps named events and the retry, and skips comments", () => {
    const parser = new SseParser();
    expect(parser.push(": keep-alive\nevent: run-ended\ndata: a\ndata:b\nretry: 3000\n\n")).toEqual([
      { event: "run-ended", data: "a\nb", retry: 3000 },
    ]);
  });

  it("carries a chunk split anywhere, even inside a CRLF", () => {
    const parser = new SseParser();
    const text = 'id: 7\r\ndata: {"seq":7}\r\n\r\n';
    const out: SseMessage[] = [];
    for (const piece of [text.slice(0, 3), text.slice(3, 12), text.slice(12, 20), text.slice(20, 21), text.slice(21)]) {
      out.push(...parser.push(piece));
    }
    expect(out).toEqual([{ event: "message", data: '{"seq":7}', id: "7" }]);
  });

  it("keeps the last id for events without one, and ignores an event with no data", () => {
    const parser = new SseParser();
    expect(parser.push("id: 4\n\ndata: x\n\n")).toEqual([{ event: "message", data: "x", id: "4" }]);
  });

  it("treats a field with no colon as an empty value and strips one leading space only", () => {
    const parser = new SseParser();
    expect(parser.push("data\ndata:  two\n\n")).toEqual([{ event: "message", data: "\n two" }]);
  });
});

describe("readSse", () => {
  it("reads a fetch body to its end and drops an unfinished last event", async () => {
    const seen: SseMessage[] = [];
    await readSse(stream(["id: 1\nda", "ta: one\n\n", "id: 2\ndata: half"]), (message) => seen.push(message));
    expect(seen).toEqual([{ event: "message", data: "one", id: "1" }]);
  });

  it("stops when aborted", async () => {
    const controller = new AbortController();
    const seen: SseMessage[] = [];
    await readSse(
      stream(["data: a\n\n", "data: b\n\n"]),
      (message) => {
        seen.push(message);
        controller.abort();
      },
      controller.signal,
    );
    expect(seen.map((message) => message.data)).toEqual(["a"]);
  });
});
