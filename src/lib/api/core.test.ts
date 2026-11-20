import axios, { AxiosError, CanceledError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiService } from "./core";
import { respond } from "./test-utils";

describe("worker API client", () => {
  const adapter = vi.fn<(config: InternalAxiosRequestConfig) => Promise<ReturnType<typeof respond>>>();
  let token: string | null;
  let api: ApiService;

  beforeEach(() => {
    adapter.mockReset();
    token = "id-token";
    const create = axios.create;
    vi.spyOn(axios, "create").mockImplementation((config) => create({ ...config, adapter }));
    api = new ApiService("http://worker.test/v1", async () => token);
    adapter.mockImplementation(async (config) => respond(config, { ok: true }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends the Firebase ID token as a bearer token, with params and cancellation", async () => {
    const signal = new AbortController().signal;
    await api.get("/projects/p/runs/r", { after: 4 }, { signal });
    const config = adapter.mock.calls[0][0];
    expect(config).toMatchObject({ baseURL: "http://worker.test/v1", params: { after: 4 }, signal });
    expect(config.withCredentials).toBeFalsy();
    expect(config.headers.get("Authorization")).toBe("Bearer id-token");
  });

  it("sends no Authorization header when nobody is signed in", async () => {
    token = null;
    await api.post("/projects/p/runs", {});
    expect(adapter.mock.calls[0][0].headers.has("Authorization")).toBe(false);
  });

  it("reads the worker's error body and ends the session on 401", async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    adapter.mockImplementation(async (config) => respond(config, { error: "token expired" }, 401));
    await expect(api.get("/projects/p/runs/r")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
      message: "token expired",
    });
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "auth:expired" }));
  });

  it.each([
    [{ error: "not_found", message: "Unknown run" }, 404, "NOT_FOUND", "Unknown run"],
    [{ error: "LLM_KEY_REQUIRED", message: "Send the key again" }, 503, "LLM_KEY_REQUIRED", "Send the key again"],
  ])("reads the worker's { error: code, message } %j", async (body, status, code, message) => {
    adapter.mockImplementation(async (config) => respond(config, body, status));
    await expect(api.get("/projects/p/runs/r")).rejects.toMatchObject({ status, code, message });
  });

  it("keeps a coded error and Retry-After", async () => {
    adapter.mockImplementation(async (config) =>
      respond(config, { error: { code: "RUN_ACTIVE", message: "A run is going" } }, 409, { "retry-after": "5" }),
    );
    await expect(api.post("/projects/p/runs")).rejects.toMatchObject({
      status: 409,
      code: "RUN_ACTIVE",
      message: "A run is going",
      retryAfter: 5,
    });
  });

  it("keeps cancellation recognizable and normalizes network errors", async () => {
    adapter.mockRejectedValueOnce(new CanceledError("Canceled"));
    await expect(api.get("/projects")).rejects.toSatisfy(axios.isCancel);
    adapter.mockRejectedValueOnce(new AxiosError("socket closed", "ERR_NETWORK"));
    await expect(api.get("/projects")).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });
});
