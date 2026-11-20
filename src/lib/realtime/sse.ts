/** One server-sent event, as the WHATWG event-stream format describes it. */
export interface SseMessage {
  /** The `event:` field; "message" when the server named none. */
  event: string;
  /** The `data:` lines, joined with "\n". */
  data: string;
  /** The `id:` field of this event, or the last one seen before it. */
  id?: string;
  /** A `retry:` the server asked for, in milliseconds. */
  retry?: number;
}

/**
 * Reads an event stream chunk by chunk. `EventSource` cannot send an `Authorization` header, so the run stream is read
 * with `fetch` and this parser. Chunks may split a line, or a `\r\n`, anywhere.
 */
export class SseParser {
  private buffer = "";
  private data: string[] = [];
  private event = "";
  private hasData = false;
  private lastId: string | undefined;
  private retry: number | undefined;
  /** A chunk ended on "\r": a "\n" opening the next chunk belongs to the same line break. */
  private pendingCr = false;

  /** Takes in a chunk of text and returns the events it completed. */
  push(chunk: string): SseMessage[] {
    let text = chunk;
    if (this.pendingCr && text.startsWith("\n")) text = text.slice(1);
    this.pendingCr = false;
    this.buffer += text;
    const out: SseMessage[] = [];
    for (;;) {
      const match = /\r\n|\r|\n/.exec(this.buffer);
      if (!match) break;
      // A lone "\r" at the end may be the first half of "\r\n".
      if (match[0] === "\r" && match.index === this.buffer.length - 1) {
        this.pendingCr = true;
        this.line(this.buffer.slice(0, match.index), out);
        this.buffer = "";
        break;
      }
      this.line(this.buffer.slice(0, match.index), out);
      this.buffer = this.buffer.slice(match.index + match[0].length);
    }
    return out;
  }

  /** The stream ended. A last event without its blank line is dropped, as the format says. */
  end(): SseMessage[] {
    this.buffer = "";
    this.reset();
    return [];
  }

  private line(line: string, out: SseMessage[]) {
    if (line === "") {
      if (this.hasData) {
        out.push({
          event: this.event || "message",
          data: this.data.join("\n"),
          ...(this.lastId !== undefined ? { id: this.lastId } : {}),
          ...(this.retry !== undefined ? { retry: this.retry } : {}),
        });
      }
      this.reset();
      return;
    }
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    switch (field) {
      case "data":
        this.data.push(value);
        this.hasData = true;
        break;
      case "event":
        this.event = value;
        break;
      case "id":
        if (!value.includes("\0")) this.lastId = value;
        break;
      case "retry":
        if (/^\d+$/.test(value)) this.retry = Number(value);
        break;
    }
  }

  private reset() {
    this.data = [];
    this.event = "";
    this.hasData = false;
    this.retry = undefined;
  }
}

/**
 * Reads a `fetch` response body as server-sent events until it ends or `signal` aborts. Resolves when the server
 * closed the stream; rejects when the connection broke.
 */
export async function readSse(
  body: ReadableStream<Uint8Array>,
  onMessage: (message: SseMessage) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  const abort = () => {
    reader.cancel().catch(() => {
      // Already closed.
    });
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (signal?.aborted) return;
      if (done) {
        for (const message of parser.push(decoder.decode())) onMessage(message);
        parser.end();
        return;
      }
      for (const message of parser.push(decoder.decode(value, { stream: true }))) {
        onMessage(message);
        if (signal?.aborted) return;
      }
    }
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
