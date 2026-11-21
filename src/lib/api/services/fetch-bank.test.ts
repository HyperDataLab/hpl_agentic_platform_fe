import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../request", () => ({ authHeaders: async () => ({ Authorization: "Bearer t" }) }));

import { type ClaimType, fetchClaimTypes, parseClaimTypes, pickClaimTypes, resetClaimTypesCache } from "./fetch-bank";

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
