import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  defaultLlmSettings,
  getLlmSettings,
  KEY_KEY,
  LlmSettingsError,
  maskKey,
  resetLlmSettings,
  SETTINGS_KEY,
  saveLlmSettings,
  toLlmPayload,
} from "./settings";

class MemoryStorage {
  items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("window", { localStorage: storage });
  vi.stubEnv("NEXT_PUBLIC_LLM_BASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_LLM_MODEL", "");
});

describe("language model settings", () => {
  it("starts from the defaults, with no key", () => {
    expect(getLlmSettings()).toEqual(defaultLlmSettings());
    expect(getLlmSettings().key).toBeUndefined();
  });

  it("saves the settings and the key apart, trimmed, and reads them back", () => {
    saveLlmSettings({
      baseUrl: " https://9router.example/v1/ ",
      model: " cx/model ",
      roleModels: { judge: " cx/judge ", skeptic: "  " },
      key: " sk-secret ",
    });
    expect(JSON.parse(storage.getItem(SETTINGS_KEY) ?? "")).toEqual({
      baseUrl: "https://9router.example/v1",
      model: "cx/model",
      roleModels: { judge: "cx/judge" },
    });
    // The key never goes into the settings object that could be shown or exported.
    expect(storage.getItem(SETTINGS_KEY)).not.toContain("sk-secret");
    expect(storage.getItem(KEY_KEY)).toBe("sk-secret");
    expect(getLlmSettings()).toEqual({
      baseUrl: "https://9router.example/v1",
      model: "cx/model",
      roleModels: { judge: "cx/judge" },
      key: "sk-secret",
    });
  });

  it("removes the key when saved without one, and resets everything", () => {
    saveLlmSettings({ ...defaultLlmSettings(), key: "sk-1" });
    saveLlmSettings({ ...defaultLlmSettings(), key: "" });
    expect(storage.getItem(KEY_KEY)).toBeNull();
    saveLlmSettings({ ...defaultLlmSettings(), model: "other", key: "sk-2" });
    resetLlmSettings();
    expect(storage.items.size).toBe(0);
  });

  it.each([
    ["ftp://9router.example", "https"],
    ["http://9router.example/v1", "https"],
    ["https://user:pass@9router.example", "user name"],
    ["https://9router.example/v1?key=1", "query"],
    ["not a url", "full URL"],
  ])("refuses the endpoint %s", (baseUrl, message) => {
    expect(() => saveLlmSettings({ ...defaultLlmSettings(), baseUrl })).toThrow(message);
  });

  it("allows http on localhost", () => {
    expect(() => saveLlmSettings({ ...defaultLlmSettings(), baseUrl: "http://localhost:20128/v1" })).not.toThrow();
  });

  it("ignores stored settings it can't read", () => {
    storage.setItem(SETTINGS_KEY, "{broken");
    expect(getLlmSettings()).toEqual(defaultLlmSettings());
  });

  it("builds the worker's llm body, and refuses without a key", () => {
    expect(() => toLlmPayload({ ...defaultLlmSettings() })).toThrow(LlmSettingsError);
    expect(
      toLlmPayload({ baseUrl: "https://r.example/v1/", model: "m", roleModels: { theorist: "t" }, key: "sk" }),
    ).toEqual({ base_url: "https://r.example/v1", api_key: "sk", model: "m", role_models: { theorist: "t" } });
    expect(toLlmPayload({ baseUrl: "https://r.example/v1", model: "m", roleModels: {}, key: "sk" })).not.toHaveProperty(
      "role_models",
    );
  });

  it("shows only the last four characters of a key", () => {
    expect(maskKey("sk-abcdef1234")).toBe("••••1234");
    expect(maskKey("abc")).toBe("••••");
    expect(maskKey(undefined)).toBe("");
  });

  it("works without localStorage (rendering the static page)", () => {
    vi.stubGlobal("window", undefined);
    expect(getLlmSettings()).toEqual(defaultLlmSettings());
  });
});

describe("roles the engine does not accept", () => {
  it("never sends a reviewer model, and still loads settings saved with one", () => {
    storage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        baseUrl: "https://9router.example/v1",
        model: "cx/model",
        roleModels: { judge: "cx/judge", reviewer: "cx/rev" },
      }),
    );
    storage.setItem(KEY_KEY, "sk-secret");
    const loaded = getLlmSettings();
    expect(loaded.roleModels).toEqual({ judge: "cx/judge" });
    expect(toLlmPayload(loaded).role_models).toEqual({ judge: "cx/judge" });
    const withReviewer = { ...loaded, roleModels: { judge: "cx/judge", reviewer: "x" } } as never;
    expect(toLlmPayload(withReviewer).role_models).toEqual({ judge: "cx/judge" });
  });
});
