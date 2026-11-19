import { z } from "zod";

/** The agents of the hypothesis stage that can each use their own model. */
export const LLM_ROLES = ["theorist", "methodologist", "skeptic", "judge", "reviewer"] as const;
export type LlmRole = (typeof LLM_ROLES)[number];
export type RoleModels = Partial<Record<LlmRole, string>>;

/** The language model a run uses: an OpenAI-compatible endpoint (9router), its key and models. */
export interface LlmSettings {
  baseUrl: string;
  model: string;
  roleModels: RoleModels;
  /** Kept in this browser's localStorage only. Never logged, never in the bundle, never stored by the worker. */
  key?: string;
}

/** What the worker's start and resume calls take as `llm`. */
export interface LlmPayload {
  base_url: string;
  api_key: string;
  model: string;
  role_models?: RoleModels;
}

export const SETTINGS_KEY = "i2h.llm.settings";
export const KEY_KEY = "i2h.llm.key";

export class LlmSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmSettingsError";
  }
}

const roleModelsSchema = z.object(
  Object.fromEntries(LLM_ROLES.map((role) => [role, z.string().trim().min(1).optional()])) as Record<
    LlmRole,
    z.ZodOptional<z.ZodString>
  >,
);
const storedSchema = z.object({
  baseUrl: z.string().min(1),
  model: z.string().min(1),
  roleModels: roleModelsSchema.optional(),
});

export function defaultLlmSettings(): LlmSettings {
  return {
    baseUrl: process.env.NEXT_PUBLIC_LLM_BASE_URL || "https://9router.oraltest.site/v1",
    model: process.env.NEXT_PUBLIC_LLM_MODEL || "cx/gpt-6-luna",
    roleModels: {},
  };
}

/** Only HTTPS endpoints (or http on localhost), with no credentials, query or fragment in the URL. */
export function validateLlmSettings(settings: LlmSettings): void {
  if (!settings.model.trim()) throw new LlmSettingsError("Choose a default model.");
  let url: URL;
  try {
    url = new URL(settings.baseUrl.trim());
  } catch {
    throw new LlmSettingsError("The endpoint must be a full URL, such as https://9router.example/v1.");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.username || url.password || url.search || url.hash) {
    throw new LlmSettingsError("The endpoint can't carry a user name, password, query or fragment.");
  }
  if (!(url.protocol === "https:" || (url.protocol === "http:" && local))) {
    throw new LlmSettingsError("The endpoint must use https (http only on localhost).");
  }
}

function cleanRoles(roles: RoleModels): RoleModels {
  const out: RoleModels = {};
  for (const role of LLM_ROLES) {
    const model = roles[role]?.trim();
    if (model) out[role] = model;
  }
  return out;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The saved settings, or the defaults. */
export function getLlmSettings(): LlmSettings {
  const defaults = defaultLlmSettings();
  const store = storage();
  if (!store) return defaults;
  try {
    const parsed = storedSchema.safeParse(JSON.parse(store.getItem(SETTINGS_KEY) || "null"));
    const saved = parsed.success
      ? { baseUrl: parsed.data.baseUrl, model: parsed.data.model, roleModels: cleanRoles(parsed.data.roleModels ?? {}) }
      : defaults;
    const key = store.getItem(KEY_KEY) || undefined;
    return { ...saved, ...(key ? { key } : {}) };
  } catch {
    return defaults;
  }
}

/** Saves the settings in this browser. An empty key removes the saved one. */
export function saveLlmSettings(settings: LlmSettings): void {
  validateLlmSettings(settings);
  const store = storage();
  if (!store) throw new LlmSettingsError("This browser doesn't allow saving settings.");
  store.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      baseUrl: settings.baseUrl.trim().replace(/\/+$/, ""),
      model: settings.model.trim(),
      roleModels: cleanRoles(settings.roleModels),
    }),
  );
  const key = settings.key?.trim();
  if (key) store.setItem(KEY_KEY, key);
  else store.removeItem(KEY_KEY);
}

export function resetLlmSettings(): void {
  const store = storage();
  store?.removeItem(SETTINGS_KEY);
  store?.removeItem(KEY_KEY);
}

/** The `llm` body of a start or resume. Throws when there is no key to send. */
export function toLlmPayload(settings: LlmSettings = getLlmSettings()): LlmPayload {
  validateLlmSettings(settings);
  const key = settings.key?.trim();
  if (!key) throw new LlmSettingsError("Add your 9router key in Settings before starting or resuming a run.");
  const roles = cleanRoles(settings.roleModels);
  return {
    base_url: settings.baseUrl.trim().replace(/\/+$/, ""),
    api_key: key,
    model: settings.model.trim(),
    ...(Object.keys(roles).length ? { role_models: roles } : {}),
  };
}

/** A key as it may be shown: its last four characters. */
export function maskKey(key: string | undefined) {
  if (!key) return "";
  return key.length <= 4 ? "••••" : `••••${key.slice(-4)}`;
}
