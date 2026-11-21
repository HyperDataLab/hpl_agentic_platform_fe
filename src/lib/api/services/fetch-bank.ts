import { z } from "zod";

import { getWritingBankUrl } from "../config";
import { authHeaders } from "../request";

const claimTypeSchema = z.object({
  id: z.string(),
  status: z.string(),
  name: z.string(),
  definition: z.string(),
  example: z.string().optional(),
  pitfalls: z.array(z.string()).optional(),
});

const framingSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    element: z.string().optional(),
    name: z.string(),
    definition: z.string(),
    whenToUse: z.string().optional(),
    example: z.string().optional(),
  })
  .passthrough();

/** The bank release this app is written against. */
export const BANK_RELEASE = "2026.11.7";

export type ClaimType = z.infer<typeof claimTypeSchema>;
export type Framing = z.infer<typeof framingSchema>;

type Entry = { id: string; status: string };

/** Parses a snapshot body and keeps the approved entries of `collection`. `null` when the body is not such a snapshot. */
function parseCollection<T extends Entry>(body: unknown, collection: string, entry: z.ZodType<T>): T[] | null {
  const parsed = z.object({ collections: z.record(z.string(), z.unknown()) }).safeParse(body);
  if (!parsed.success) return null;
  const list = z.array(entry).safeParse(parsed.data.collections[collection]);
  if (!list.success) return null;
  return list.data.filter((item) => item.status === "approved");
}

export const parseClaimTypes = (body: unknown) => parseCollection(body, "claim-types", claimTypeSchema);
export const parseFramings = (body: unknown) => parseCollection(body, "framing-types", framingSchema);

/** The entries of `ids` found in `entries`, in the order of `ids`. Unknown ids are skipped. */
export function pickEntries<T extends { id: string }>(ids: readonly string[], entries: readonly T[] | null): T[] {
  if (!entries) return [];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export const pickClaimTypes = (ids: readonly string[], types: readonly ClaimType[] | null) => pickEntries(ids, types);
export const pickFramings = (ids: readonly string[], framings: readonly Framing[] | null) => pickEntries(ids, framings);

const sessions = new Map<string, Promise<unknown>>();

async function loadCollection<T>(collection: string, parse: (body: unknown) => T[] | null): Promise<T[] | null> {
  try {
    const response = await fetch(
      `${getWritingBankUrl()}/bank/v1/snapshot?collections=${collection}&release=${BANK_RELEASE}`,
      { headers: await authHeaders() },
    );
    if (!response.ok) {
      console.debug(`Writing Bank answered ${response.status}; ${collection} hints are off.`);
      return null;
    }
    return parse(await response.json());
  } catch {
    console.debug(`Writing Bank is unreachable; ${collection} hints are off.`);
    return null;
  }
}

function once<T>(collection: string, parse: (body: unknown) => T[] | null): Promise<T[] | null> {
  let pending = sessions.get(collection) as Promise<T[] | null> | undefined;
  if (!pending) {
    pending = loadCollection(collection, parse);
    sessions.set(collection, pending);
  }
  return pending;
}

/** The approved claim types of the Writing Bank. One request per page load; `null` on any failure. */
export const fetchClaimTypes = () => once("claim-types", parseClaimTypes);

/** The approved framing types (objectives, question types, hypotheses). One request per page load; `null` on failure. */
export const fetchFramings = () => once("framing-types", parseFramings);

/** For tests: forget the session cache. */
export function resetClaimTypesCache() {
  sessions.clear();
}

export const MIN_CLASSIFY_CHARS = 12;
export const MAX_CLASSIFY_CHARS = 1000;

const classifyTopicSchema = z.object({
  topic: z.object({ id: z.string(), name: z.string(), score: z.number().optional() }),
  subfield: z.object({ id: z.string(), name: z.string() }),
  field: z.object({ id: z.string(), name: z.string() }).passthrough(),
  domain: z.object({ id: z.string(), name: z.string() }),
});
const classifySchema = z.object({ topics: z.array(classifyTopicSchema) });

export type ClassifiedTopic = z.infer<typeof classifyTopicSchema>;

/** OpenAlex topics of a research topic text, or `null` on any failure or when the text is outside 12–1000 characters. */
export async function classifyTopic(title: string): Promise<ClassifiedTopic[] | null> {
  const text = title.trim();
  if (text.length < MIN_CLASSIFY_CHARS || text.length > MAX_CLASSIFY_CHARS) return null;
  try {
    const response = await fetch(`${getWritingBankUrl()}/bank/v1/classify`, {
      method: "POST",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({ title: text }),
    });
    if (!response.ok) {
      console.debug(`Writing Bank answered ${response.status}; field suggestions are off.`);
      return null;
    }
    const parsed = classifySchema.safeParse(await response.json());
    return parsed.success ? parsed.data.topics : null;
  } catch {
    console.debug("Writing Bank is unreachable; field suggestions are off.");
    return null;
  }
}
