import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../request", () => ({ authHeaders: async () => ({ Authorization: "Bearer t" }) }));

import { INTENT_FRAMINGS } from "@/app/(main)/projects/[projectId]/_components/run-studio/start-run-dialog";

import {
  BANK_RELEASE,
  type ClaimType,
  classifyTopic,
  fetchClaimTypes,
  fetchFramings,
  parseClaimTypes,
  parseFramings,
  pickClaimTypes,
  pickFramings,
  resetClaimTypesCache,
} from "./fetch-bank";

const entry = (id: string, status = "approved"): ClaimType => ({ id, status, name: id, definition: `def ${id}` });
const snapshot = (types: ClaimType[]) => ({ release: "r1", collections: { "claim-types": types }, aliases: {} });

function respond(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  resetClaimTypesCache();
  vi.spyOn(console, "debug").mockReturnValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());

describe("fetchClaimTypes", () => {
  it("keeps approved entries and drops drafts", async () => {
    vi.stubGlobal("fetch", respond(200, snapshot([entry("ct.causal"), entry("ct.x", "draft")])));
    expect((await fetchClaimTypes())?.map((t) => t.id)).toEqual(["ct.causal"]);
  });

  it("returns null on a non-200 answer", async () => {
    vi.stubGlobal("fetch", respond(403, { error: "forbidden", message: "no" }));
    expect(await fetchClaimTypes()).toBeNull();
  });

  it("returns null on a malformed body", async () => {
    vi.stubGlobal("fetch", respond(200, { release: "r1", collections: {} }));
    expect(await fetchClaimTypes()).toBeNull();
  });

  it("returns null when the request throws, and fetches once per session", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("CORS");
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchClaimTypes()).toBeNull();
    expect(await fetchClaimTypes()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("pickClaimTypes", () => {
  it("skips unknown ids and keeps the order of the ids", () => {
    const types = [entry("ct.b"), entry("ct.a")];
    expect(pickClaimTypes(["ct.a", "ct.missing", "ct.b"], types).map((t) => t.id)).toEqual(["ct.a", "ct.b"]);
    expect(pickClaimTypes(["ct.a"], null)).toEqual([]);
  });
});

describe("parseClaimTypes", () => {
  it("rejects a non-object", () => {
    expect(parseClaimTypes("nope")).toBeNull();
  });
});

const framing = (id: string, status = "approved") => ({
  id,
  status,
  element: "objective",
  name: id,
  definition: "d",
  extra: 1,
});

describe("framings", () => {
  it("keeps approved framings, keeps extra fields, pins the release", async () => {
    const fetchMock = respond(200, {
      release: BANK_RELEASE,
      collections: { "framing-types": [framing("fr.a"), framing("fr.b", "draft")] },
    });
    vi.stubGlobal("fetch", fetchMock);
    expect((await fetchFramings())?.map((f) => f.id)).toEqual(["fr.a"]);
    expect(String((fetchMock.mock.calls as unknown[][])[0]?.[0])).toContain(
      `collections=framing-types&release=${BANK_RELEASE}`,
    );
  });

  it("returns null on a body without the collection", () => {
    expect(parseFramings({ collections: { "claim-types": [] } })).toBeNull();
    expect(parseClaimTypes({ collections: { "framing-types": [] } })).toBeNull();
  });

  it("picks in order and every mapped id is a string list per intent", () => {
    const list = parseFramings({ collections: { "framing-types": [framing("fr.b"), framing("fr.a")] } });
    expect(pickFramings(["fr.a", "fr.x", "fr.b"], list).map((f) => f.id)).toEqual(["fr.a", "fr.b"]);
    expect(Object.keys(INTENT_FRAMINGS).sort()).toEqual(["compare", "explain", "test"]);
    expect(INTENT_FRAMINGS.compare.at(0)).toBe("fr.objective-compare");
  });
});

describe("classifyTopic", () => {
  const topic = "Asynchronous federated learning under stragglers";
  const ok = {
    source: "text",
    primary: {},
    topics: [
      {
        topic: { id: "T1", name: "Federated", score: 0.9 },
        subfield: { id: "S1", name: "AI" },
        field: { id: "F1", name: "CS", slug: "cs" },
        domain: { id: "D1", name: "Physical" },
      },
    ],
  };

  it("returns the topics", async () => {
    vi.stubGlobal("fetch", respond(200, ok));
    expect((await classifyTopic(topic))?.[0]?.subfield.name).toBe("AI");
  });

  it("returns null on non-200 and on a malformed body", async () => {
    vi.stubGlobal("fetch", respond(502, { error: "x" }));
    expect(await classifyTopic(topic)).toBeNull();
    vi.stubGlobal("fetch", respond(200, { topics: "no" }));
    expect(await classifyTopic(topic)).toBeNull();
  });

  it("does not call for a topic outside 12-1000 characters", async () => {
    const fetchMock = respond(200, ok);
    vi.stubGlobal("fetch", fetchMock);
    expect(await classifyTopic("too short")).toBeNull();
    expect(await classifyTopic("x".repeat(1001))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
