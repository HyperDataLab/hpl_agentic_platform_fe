"use client";

import { useEffect, useId, useState } from "react";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { z } from "zod";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPaperLabUrl } from "@/lib/api/config";
import { authHeaders } from "@/lib/api/request";
import type { RunSources } from "@/lib/api/services/fetch-runs";
import { getLlmSettings } from "@/lib/llm/settings";

const corporaSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string().optional(),
    kind: z.string().optional(),
    updatedAt: z.string().optional(),
  }),
);
export type Corpus = z.infer<typeof corporaSchema>[number];

/** The lab's corpora in PaperLab's PDF worker, signed in with the same lab account. */
async function fetchCorpora(signal: AbortSignal): Promise<Corpus[]> {
  const response = await fetch(`${getPaperLabUrl()}/corpora`, { headers: await authHeaders(), signal });
  if (!response.ok) throw new Error(`PaperLab answered ${response.status}.`);
  return corporaSchema.parse(await response.json());
}

const NONE = "none";
const TOGGLES: { key: "lab_kg" | "sciatlas" | "fulltext"; label: string; line: string }[] = [
  { key: "lab_kg", label: "Lab knowledge graph", line: "Papers the lab has already read and linked." },
  { key: "sciatlas", label: "SciAtlas", line: "A second search over SciAtlas, next to OpenAlex." },
  { key: "fulltext", label: "Full texts", line: "Read stored PDFs (PaperFetchHub) instead of abstracts only." },
];

function corpusHint(corpora: { isPending: boolean; isError: boolean; data?: Corpus[] }) {
  if (corpora.isPending) return "Loading the lab's corpora…";
  if (corpora.isError) return "Unable to load PaperLab's corpora. The run can still start without one.";
  return corpora.data?.length ? "Its papers seed the literature search." : "PaperLab has no corpora yet.";
}

/** What a run reads from: none of the extras until the person picks them. */
export function useRunSources() {
  return useState<RunSources>({});
}

/** Where the run reads papers from, besides the open literature search. */
export function SourcesInput({ value, onChange }: { value: RunSources; onChange(value: RunSources): void }) {
  const id = useId();
  const corpora = useQuery({ queryKey: ["paperlab", "corpora"], queryFn: ({ signal }) => fetchCorpora(signal) });
  const set = (patch: Partial<RunSources>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor={`${id}-corpus`}>PaperLab corpus</FieldLabel>
        <Select
          value={value.corpus_id ?? NONE}
          onValueChange={(next) => set({ corpus_id: next === NONE ? undefined : next })}
          disabled={!corpora.data?.length}
        >
          <SelectTrigger id={`${id}-corpus`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={NONE}>No corpus</SelectItem>
              {corpora.data?.map((corpus) => (
                <SelectItem key={corpus.id} value={corpus.id}>
                  {corpus.title || corpus.id}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldDescription>{corpusHint(corpora)}</FieldDescription>
      </Field>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-medium text-sm">Other sources</legend>
        {TOGGLES.map((toggle) => (
          <Field key={toggle.key} orientation="horizontal">
            <Checkbox
              id={`${id}-${toggle.key}`}
              checked={Boolean(value[toggle.key])}
              onCheckedChange={(checked) => set({ [toggle.key]: checked === true })}
            />
            <FieldContent>
              <FieldLabel htmlFor={`${id}-${toggle.key}`}>{toggle.label}</FieldLabel>
              <FieldDescription>{toggle.line}</FieldDescription>
            </FieldContent>
          </Field>
        ))}
      </fieldset>
    </div>
  );
}

/** A start needs the 9router key from Settings: says so before the person types a topic for nothing. */
export function LlmKeyNotice() {
  const [missing, setMissing] = useState(false);
  useEffect(() => setMissing(!getLlmSettings().key), []);
  if (!missing) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-3 text-sm">
      <KeyRound className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        <FieldTitle>Add your 9router key first</FieldTitle>
        <p className="text-muted-foreground">
          Runs use the key saved in this browser.{" "}
          <Link href="/settings" className="font-medium text-foreground underline underline-offset-4">
            Open Settings
          </Link>
        </p>
      </div>
    </div>
  );
}
