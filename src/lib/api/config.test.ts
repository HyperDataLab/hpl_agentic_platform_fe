import { afterEach, describe, expect, it, vi } from "vitest";

import { getApiBaseUrl, getWorkerUrl } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("API URL configuration", () => {
  it("talks to the local worker by default", () => {
    vi.stubEnv("NEXT_PUBLIC_I2H_WORKER_URL", "");
    expect(getApiBaseUrl()).toBe("http://localhost:8787/v1");
  });

  it("uses the configured worker without a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_I2H_WORKER_URL", "https://i2h-worker.example.workers.dev//");
    expect(getWorkerUrl()).toBe("https://i2h-worker.example.workers.dev");
    expect(getApiBaseUrl()).toBe("https://i2h-worker.example.workers.dev/v1");
  });
});
