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

const snapshotSchema = z.object({
  release: z.string(),
  collections: z.object({ "claim-types": z.array(claimTypeSchema) }),
});

export type ClaimType = z.infer<typeof claimTypeSchema>;

/** Parses a snapshot body and keeps the approved claim types. `null` when the body is not a snapshot. */
export function parseClaimTypes(body: unknown): ClaimType[] | null {
  const parsed = snapshotSchema.safeParse(body);
  if (!parsed.success) return null;
  return parsed.data.collections["claim-types"].filter((entry) => entry.status === "approved");
}

/** The entries of `ids` found in `types`, in the order of `ids`. Unknown ids are skipped. */
export function pickClaimTypes(ids: readonly string[], types: readonly ClaimType[] | null): ClaimType[] {
  if (!types) return [];
  const byId = new Map(types.map((entry) => [entry.id, entry]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

let session: Promise<ClaimType[] | null> | null = null;

async function load(): Promise<ClaimType[] | null> {
  try {
    const response = await fetch(`${getWritingBankUrl()}/bank/v1/snapshot?collections=claim-types`, {
      headers: await authHeaders(),
    });
    if (!response.ok) {
      console.debug(`Writing Bank answered ${response.status}; claim-type hints are off.`);
      return null;
    }
    return parseClaimTypes(await response.json());
  } catch {
    console.debug("Writing Bank is unreachable; claim-type hints are off.");
    return null;
  }
}

/** The approved claim types of the Writing Bank. One request per page load; `null` on any failure. */
export function fetchClaimTypes(): Promise<ClaimType[] | null> {
  session ??= load();
  return session;
}

/** For tests: forget the session cache. */
export function resetClaimTypesCache() {
  session = null;
}
