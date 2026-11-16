"use client";

import { useCallback, useMemo, useState } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ChevronRight, Copy, HardDrive, Table2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInfiniteDatasetVersions } from "@/hooks/use-datasets-query";
import { useLocalNodesQuery } from "@/hooks/use-local-nodes-query";
import type { DatasetItem, DatasetPreviewData, DatasetVersionItem, LocalCard } from "@/lib/api/services/fetch-datasets";
import { isLocalVersion } from "@/lib/api/services/fetch-datasets";

import { ColumnKindIcon } from "./column-kind-icon";
import { DatasetCsvPreview } from "./dataset-csv-preview";
import { type ColumnKind, inferColumnKind } from "./dataset-preview";
import { DatasetReview } from "./dataset-review";
import { useVersionRuns } from "./dataset-stage-hooks";
import { DatasetVersionStatusBadges } from "./dataset-versions";

type LocalVariable = LocalCard["variables"][number];

export function mapProfileVariable(card: LocalCard | null | undefined, name: string): LocalVariable | undefined {
  return card?.variables.find((variable) => variable.name === name);
}

export function toggleProfileSelection(current: string | null, name: string): string | null {
  return current === name ? null : name;
}

const flagExplanations: Record<string, string> = {
  possible_pii: "May contain personally identifying information.",
  near_unique: "Most values are unique and may make records identifying.",
  high_missing: "More than 20% of values are missing.",
  free_text: "Contains free text instead of a fixed set of categories.",
  constant: "Only one observed value was reported.",
  numeric_with_text_codes: "Numeric values include text-coded entries.",
  small_categories: "Some category counts may be withheld.",
};

function profileIconKind(type: LocalVariable["type"] | undefined): ColumnKind {
  if (type === "numeric") return "number";
  if (type === "date") return "date";
  return "text";
}

function columnTypeLabel(kind: ColumnKind): string {
  return kind === "number" ? "Number" : kind === "date" ? "Date" : kind === "boolean" ? "Boolean" : "Text";
}

type View = "profile" | "review" | "versions";
const VIEWS: { value: View; label: string }[] = [
  { value: "profile", label: "Profile" },
  { value: "review", label: "Dataset review" },
  { value: "versions", label: "Versions" },
];
// Links made before the stage and the card became one tab.
const LEGACY: Record<string, View> = { stage: "review", card: "review" };

/** One column's numbers, flags and what the Platform sees of it. */
function ColumnInspector({
  name,
  variable,
  kind,
  local,
  onClear,
}: {
  name: string;
  variable: LocalVariable | undefined;
  kind: ColumnKind | undefined;
  local: boolean;
  onClear: () => void;
}) {
  const flags = variable?.flags.filter((flag) => flag !== "levels_withheld") ?? [];
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="break-words font-semibold">{name}</p>
        <p className="text-muted-foreground text-xs capitalize">
          {variable
            ? `${variable.type} · ${variable.measure}`
            : kind
              ? `${columnTypeLabel(kind)} · inferred from preview`
              : "Type not reported"}
        </p>
      </div>
      {variable ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-muted-foreground">Valid</dt>
          <dd>{variable.summary.n_valid ?? "Withheld"}</dd>
          <dt className="text-muted-foreground">Missing</dt>
          <dd>{variable.summary.n_missing ?? "Withheld"}</dd>
          <dt className="text-muted-foreground">Distinct</dt>
          <dd>{variable.summary.n_distinct == null ? "Withheld" : `~${variable.summary.n_distinct}`}</dd>
          <dt className="text-muted-foreground">Mean / SD</dt>
          <dd>
            {variable.summary.mean ?? "—"} / {variable.summary.sd ?? "—"}
          </dd>
        </dl>
      ) : (
        <p className="text-muted-foreground text-xs">Statistics have not been reported for this column.</p>
      )}
      {flags.map((flag) => (
        <div key={flag}>
          <Badge variant="outline">{flag.replaceAll("_", " ")}</Badge>
          <p className="mt-1 text-muted-foreground text-xs">
            {flagExplanations[flag] ?? "This flag was included in the released data card."}
          </p>
        </div>
      ))}
      {local && variable && (
        <p className="rounded-md border p-2.5 text-muted-foreground text-xs">
          {/^v\d+$/i.test(variable.name)
            ? `Alias ${variable.name}; the original field name stays on the Local Node.`
            : `Field name ${variable.name} was released.`}{" "}
          Category levels are withheld.
        </p>
      )}
      <Button variant="outline" size="sm" onClick={onClear}>
        <X data-icon="inline-start" />
        Close
      </Button>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => void navigator.clipboard.writeText(value)}
    >
      <Copy className="size-3.5" />
    </button>
  );
}

/** What a version is made of: its fingerprint, disclosure, node, size and limits. */
function VersionFacts({ item, nodeName }: { item: DatasetVersionItem; nodeName: string | undefined }) {
  const local = isLocalVersion(item);
  const gaps = item.local_card?.report.gaps ?? [];
  return (
    <div className="space-y-3 border-t px-3 py-3 text-xs">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="text-muted-foreground">Created</dt>
        <dd>{new Date(item.created_at).toLocaleString("en-US")}</dd>
        <dt className="text-muted-foreground">Size</dt>
        <dd className="tabular-nums">
          {local ? "~" : ""}
          {item.row_count.toLocaleString("en-US")} rows · {item.column_names.length} columns
        </dd>
        <dt className="text-muted-foreground">Fingerprint</dt>
        <dd className="flex items-center gap-1.5">
          <span className="break-all font-mono">{item.sha256.slice(0, 16)}…</span>
          <CopyButton value={item.sha256} label="Copy fingerprint" />
        </dd>
        <dt className="text-muted-foreground">Disclosure</dt>
        <dd className="capitalize">{item.disclosure ?? "standard"}</dd>
        <dt className="text-muted-foreground">Node</dt>
        <dd className="flex items-center gap-1.5">
          {local ? (nodeName ?? "Local Node") : "Platform"}
          {local && item.runner_id && <CopyButton value={item.runner_id} label="Copy Local Node ID" />}
        </dd>
      </dl>
      <details className="group">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <ChevronRight
            className="size-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none"
            aria-hidden="true"
          />
          Limits · {gaps.length}
        </summary>
        {gaps.length ? (
          <ul className="mt-2 list-disc pl-5">
            {gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted-foreground">No additional limits reported.</p>
        )}
      </details>
    </div>
  );
}

export function DatasetWorkspace({
  dataset,
  projectId,
  version,
  onShowLatest,
  onSelectVersion,
}: {
  dataset: DatasetItem;
  projectId: string;
  version: DatasetVersionItem | null;
  onShowLatest: () => void;
  onSelectVersion: (version: DatasetVersionItem) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  // The version open in the Versions tab; the one on show unless the person folds it or opens another.
  const [openId, setOpenId] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  // The tab lives in the URL (`?view=`), so the header can link to one and the run view can link back to the card.
  const params = useSearchParams();
  const wanted = params.get("view");
  const view: View = VIEWS.find((v) => v.value === wanted)?.value ?? LEGACY[wanted ?? ""] ?? "profile";
  const setView = (next: string) => {
    const query = new URLSearchParams(params.toString());
    if (next === "profile") query.delete("view");
    else query.set("view", next);
    router.replace(`${pathname}${query.size ? `?${query}` : ""}`, { scroll: false });
  };
  const openRunId = params.get("run");
  const [previewSchema, setPreviewSchema] = useState<{
    versionId: string;
    kinds: Record<string, ColumnKind>;
  } | null>(null);
  const versionQuery = useInfiniteDatasetVersions(projectId, dataset.id);
  const localNodes = useLocalNodesQuery(projectId);
  const stageRuns = useVersionRuns(projectId, version?.id);
  const local = isLocalVersion(version);
  const card = version?.local_card;
  const columns = version?.column_names ?? [];
  const previewKinds = previewSchema && previewSchema.versionId === version?.id ? previewSchema.kinds : {};
  const onPreviewData = useCallback(
    (data: DatasetPreviewData | undefined) => {
      if (!data || !version) return;
      const kinds = Object.fromEntries(
        data.columns.map((name, index) => [name, inferColumnKind(data.rows.map((row) => row[index] ?? ""))]),
      );
      setPreviewSchema((current) =>
        current?.versionId === version.id && JSON.stringify(current.kinds) === JSON.stringify(kinds)
          ? current
          : { versionId: version.id, kinds },
      );
    },
    [version],
  );
  const versions = useMemo(
    () => [...versionQuery.versions].sort((a, b) => b.version_number - a.version_number),
    [versionQuery.versions],
  );
  const pick = (name: string) => setSelected((current) => toggleProfileSelection(current, name));

  if (!version) return null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-4">
        <Tabs value={view} onValueChange={setView} className="min-w-0">
          <TabsList aria-label="Workspace view">
            {VIEWS.map((v) => (
              <TabsTrigger key={v.value} value={v.value} className="flex-none">
                {v.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {view === "review" && (
          <DatasetReview
            projectId={projectId}
            dataset={dataset}
            version={version}
            runs={stageRuns.runs}
            openRunId={openRunId}
          />
        )}
        {view === "versions" && (
          <section aria-label="Versions" className="flex flex-col gap-5">
            <ol className="relative flex flex-col gap-3 before:absolute before:top-3 before:bottom-4 before:left-[0.7rem] before:w-px before:bg-border">
              {versions.map((item) => {
                const older = versions.find((v) => v.version_number === item.version_number - 1);
                const open = (openId ?? version.id) === item.id;
                return (
                  <li key={item.id} className="relative pl-7">
                    <span
                      className={`absolute top-2 left-1.5 z-10 size-2.5 rounded-full ring-4 ring-background ${item.id === version.id ? "bg-foreground" : "bg-muted-foreground/50"}`}
                    />
                    <div className="overflow-hidden rounded-md border bg-background">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => {
                          // A version you are not looking at opens and becomes the one shown; the shown one folds.
                          if (item.id === version.id) setOpenId(open ? "" : item.id);
                          else {
                            setOpenId(item.id);
                            if (item.id === dataset.latest_version?.id) onShowLatest();
                            else onSelectVersion(item);
                          }
                        }}
                        className="w-full p-3 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Show version ${item.version_number}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono font-semibold text-sm">v{item.version_number}</span>
                          <time className="text-muted-foreground text-xs" dateTime={item.created_at}>
                            {new Date(item.created_at).toLocaleDateString("en-US")}
                          </time>
                        </div>
                        <DatasetVersionStatusBadges
                          version={{ ...item, stale: item.superseded_by_version != null }}
                          latest={item.id === dataset.latest_version?.id}
                        />
                        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
                          {isLocalVersion(item) ? <HardDrive className="size-3.5" /> : <Table2 className="size-3.5" />}
                          {isLocalVersion(item)
                            ? "Local Node"
                            : item.source_type === "connection"
                              ? (item.source?.connection_name ?? "Connected source")
                              : item.original_filename}
                          <span className="tabular-nums">
                            · {isLocalVersion(item) ? "~" : ""}
                            {item.row_count.toLocaleString("en-US")} rows · {item.column_names.length} columns
                          </span>
                        </p>
                        {older && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.row_count !== older.row_count && (
                              <Badge variant="outline">
                                {item.row_count > older.row_count ? "+" : "−"}
                                {Math.abs(item.row_count - older.row_count)} rows
                              </Badge>
                            )}
                            {item.column_names
                              .filter((column) => !older.column_names.includes(column))
                              .map((column) => (
                                <Badge key={column} variant="outline">
                                  + {column}
                                </Badge>
                              ))}
                          </div>
                        )}
                        {item.superseded_by_version != null && (
                          <p className="mt-2 text-amber-700 text-xs dark:text-amber-300">
                            Stale results · superseded by v{item.superseded_by_version}
                          </p>
                        )}
                      </button>
                      {open && (
                        <VersionFacts
                          item={item}
                          nodeName={localNodes.data?.data.find((node) => node.id === item.runner_id)?.name}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
              {!dataset.latest_version && <li className="pl-7 text-muted-foreground text-sm">No versions yet.</li>}
            </ol>
            {versionQuery.hasNextPage && (
              <Button
                className="mt-3"
                variant="outline"
                size="sm"
                disabled={versionQuery.isFetchingNextPage}
                onClick={() => void versionQuery.fetchNextPage()}
              >
                {versionQuery.isFetchingNextPage ? "Loading versions…" : "Load older versions"}
              </Button>
            )}
          </section>
        )}
        {view === "profile" && (
          <section aria-label="Dataset profile" className="flex min-w-0 flex-col gap-4">
            {!card && !local && (
              <p className="rounded-md border bg-muted/30 px-3 py-2 text-muted-foreground text-xs">
                Column statistics are not computed for Platform-stored versions yet.
              </p>
            )}
            {card && <p className="text-muted-foreground text-xs">Distributions are not computed for this version.</p>}
            <div
              className={card ? "grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3" : "divide-y rounded-lg border"}
            >
              {columns.map((name, index) => {
                const variable = mapProfileVariable(card, name);
                const kind = variable ? profileIconKind(variable.type) : (previewKinds[name] ?? "text");
                if (!card) {
                  return (
                    <div key={`${name}-${index}`}>
                      <button
                        type="button"
                        data-column-kind={kind}
                        aria-expanded={selected === name}
                        onClick={() => pick(name)}
                        className={`flex min-h-11 w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected === name ? "bg-muted" : "hover:bg-muted/50"}`}
                      >
                        <ColumnKindIcon kind={kind} className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                        <span className="shrink-0 text-muted-foreground text-xs">{columnTypeLabel(kind)}</span>
                      </button>
                      {selected === name && (
                        <div className="border-t bg-muted/30 p-3">
                          <ColumnInspector
                            name={name}
                            variable={undefined}
                            kind={kind}
                            local={local}
                            onClear={() => setSelected(null)}
                          />
                        </div>
                      )}
                    </div>
                  );
                }
                const summary = variable?.summary;
                const total =
                  summary?.n_valid != null && summary.n_missing != null ? summary.n_valid + summary.n_missing : null;
                const missing =
                  total != null && summary?.n_missing != null ? Math.round((summary.n_missing / total) * 100) : null;
                const flags = variable?.flags.filter((flag) => flag !== "levels_withheld") ?? [];
                const open = selected === name;
                return (
                  <motion.div
                    key={`${name}-${index}`}
                    layout="position"
                    className={`min-w-0 rounded-lg border bg-card transition-colors ${open ? "col-span-full border-foreground" : "hover:bg-muted/60"}`}
                  >
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => pick(name)}
                      className="block w-full rounded-lg p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-start gap-2">
                        <ColumnKindIcon kind={kind} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 break-words font-medium text-sm">{name}</span>
                        <span className="text-muted-foreground text-xs">{columnTypeLabel(kind)}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-foreground/60"
                            style={{ width: `${missing ?? 0}%` }}
                          />
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {missing === null ? "Missing n/a" : `${missing}% missing`}
                        </span>
                      </div>
                      <p className="mt-2 flex flex-wrap items-center justify-between gap-1 text-muted-foreground text-xs">
                        <span>
                          Distinct{" "}
                          {summary?.n_distinct == null ? "—" : `~${summary.n_distinct.toLocaleString("en-US")}`}
                        </span>
                        {flags.length > 0 && <span>{flags.map((flag) => flag.replaceAll("_", " ")).join(" · ")}</span>}
                      </p>
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t p-3">
                            <ColumnInspector
                              name={name}
                              variable={variable}
                              kind={kind}
                              local={local}
                              onClear={() => setSelected(null)}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
              {!columns.length && (
                <p className="col-span-full rounded-md border border-dashed p-5 text-center text-muted-foreground text-sm">
                  No columns are available for this version.
                </p>
              )}
            </div>
            {!local && (
              <DatasetCsvPreview
                projectId={projectId}
                datasetId={dataset.id}
                version={version}
                inline
                note={false}
                onPreviewData={onPreviewData}
              />
            )}
          </section>
        )}
      </div>
    </div>
  );
}
