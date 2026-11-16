"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AlertCircle, FileSpreadsheet, LoaderCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ColumnKindIcon } from "./column-kind-icon";
import { previewRows } from "./csv-preview";
import { formatSize } from "./dataset-format";
import {
  type DatasetPreviewSource,
  type DatasetPreviewTable,
  inferColumnKind,
  previewColumnKey,
  previewRowKey,
  removePreviewSource,
} from "./dataset-preview";
import type { ExcelPreviewRequest, ExcelPreviewResponse, FilePreviewTable } from "./project-file-preview-types";

function approximateRows(table: FilePreviewTable) {
  const count = Math.max(0, table.rows.length - 1);
  return count >= 99 ? "~100+" : `~${count}`;
}

async function parseFile(file: File, id: string): Promise<DatasetPreviewSource> {
  if (file.size === 0) throw new Error("The file is empty.");
  if (file.size > 50 * 1024 * 1024) throw new Error("The file must be no larger than 50 MiB.");
  if (/\.csv$/i.test(file.name)) {
    const text = await file.text();
    const rows = text.trim() ? previewRows(text, ",") : [];
    if (!rows.length) throw new Error("The file has no rows to preview.");
    const [headers, ...data] = rows;
    const table: DatasetPreviewTable = {
      id: `${id}:0`,
      fileId: id,
      label: file.name,
      headers,
      rows: data.slice(0, 20).map((row) => row.slice(0, 20)),
      approximateRows: rows.length >= 101 ? "~100+" : `~${Math.max(0, rows.length - 1)}`,
    };
    return { id, file, name: file.name.replace(/\.csv$/i, "").slice(0, 160), status: "ready", tables: [table] };
  }

  const buffer = await file.arrayBuffer();
  const worker = new Worker(new URL("./project-file-excel.worker.ts", import.meta.url), { type: "module" });
  try {
    const sheets = await new Promise<{ names: string[]; first: FilePreviewTable }>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("The Excel preview took too long.")), 30_000);
      worker.onmessage = (event: MessageEvent<ExcelPreviewResponse>) => {
        if (event.data.type === "error") {
          window.clearTimeout(timeout);
          reject(new Error("This Excel file could not be parsed. Check that it is a valid .xlsx or .xls file."));
        } else if (event.data.type === "ready") {
          window.clearTimeout(timeout);
          resolve({ names: event.data.sheets, first: event.data.table });
        }
      };
      worker.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("This Excel file could not be parsed. Check that it is a valid .xlsx or .xls file."));
      };
      worker.postMessage({ type: "load", buffer } satisfies ExcelPreviewRequest, [buffer]);
    });

    const tables: DatasetPreviewTable[] = [];
    for (const [index, label] of sheets.names.entries()) {
      let tableData = sheets.first;
      if (index > 0) {
        tableData = await new Promise<FilePreviewTable>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error("The Excel preview took too long.")), 30_000);
          worker.onmessage = (event: MessageEvent<ExcelPreviewResponse>) => {
            if (event.data.type === "error") {
              window.clearTimeout(timeout);
              reject(new Error(`The sheet “${label}” could not be previewed.`));
            } else if (event.data.type === "sheet" && event.data.index === index) {
              window.clearTimeout(timeout);
              resolve(event.data.table);
            }
          };
          worker.postMessage({ type: "sheet", index } satisfies ExcelPreviewRequest);
        });
      }
      const [firstRow, ...rows] = tableData.rows;
      const headers = firstRow?.map((cell, cellIndex) => cell || tableData.headers[cellIndex]) ?? [];
      tables.push({
        id: `${id}:${index}`,
        fileId: id,
        label,
        headers,
        rows: rows.slice(0, 20).map((row) => row.slice(0, 20)),
        approximateRows: approximateRows(tableData),
      });
    }
    if (!tables.length) throw new Error("This workbook does not contain any sheets to preview.");
    return {
      id,
      file,
      name: file.name.replace(/\.(xlsx|xls)$/i, "").slice(0, 160),
      status: "ready",
      tables,
    };
  } finally {
    worker.terminate();
  }
}

export function DatasetFilePreview({
  sources,
  onChange,
  externalFiles = [],
}: {
  sources: DatasetPreviewSource[];
  onChange: Dispatch<SetStateAction<DatasetPreviewSource[]>>;
  externalFiles?: File[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const allTables = useMemo(() => sources.flatMap((source) => source.tables), [sources]);
  const selected = allTables.find((table) => table.id === selectedTableId) ?? allTables[0];
  const previewColumns = selected
    ? selected.headers.slice(0, 20).map((header, index) => ({
        key: previewColumnKey(selected.id, selected.headers, index),
        header,
        index,
      }))
    : [];
  const previewGridRows = selected
    ? selected.rows.slice(0, 20).map((row, index) => ({
        key: previewRowKey(selected.id, selected.rows, index),
        row,
      }))
    : [];

  useEffect(() => {
    if (selectedTableId && !allTables.some((table) => table.id === selectedTableId)) setSelectedTableId(null);
  }, [allTables, selectedTableId]);

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const incoming = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name.replace(/\.(csv|xlsx|xls)$/i, "").slice(0, 160),
      status: "loading" as const,
      tables: [],
    }));
    onChange((current) => [...current, ...incoming]);
    for (const source of incoming) {
      void parseFile(source.file, source.id)
        .then((parsed) => onChangeLatest(source.id, parsed))
        .catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : "The file could not be parsed.";
          onChangeLatest(source.id, {
            ...source,
            status: "error",
            reason,
          });
        });
    }
    if (input.current) input.current.value = "";
  }

  const onChangeLatest = useCallback(
    (id: string, parsed: DatasetPreviewSource) => {
      onChange((current) => current.map((source) => (source.id === id ? parsed : source)));
    },
    [onChange],
  );

  const parsedExternalRef = useRef(new Set<File>());
  useEffect(() => {
    const freshFiles = externalFiles.filter((file) => !parsedExternalRef.current.has(file));
    if (!freshFiles.length) return;
    freshFiles.forEach((file) => {
      parsedExternalRef.current.add(file);
    });
    const incoming = freshFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name.replace(/\.(csv|xlsx|xls)$/i, "").slice(0, 160),
      status: "loading" as const,
      tables: [],
    }));
    onChange((current) => [...current, ...incoming]);
    incoming.forEach((source) => {
      void parseFile(source.file, source.id)
        .then((parsed) => onChangeLatest(source.id, parsed))
        .catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : "The file could not be parsed.";
          onChangeLatest(source.id, {
            ...source,
            status: "error",
            reason,
          });
        });
    });
  }, [externalFiles, onChange, onChangeLatest]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
      <input
        ref={input}
        type="file"
        accept=".csv,.xlsx,.xls"
        multiple
        className="sr-only"
        aria-label="Choose CSV or Excel files"
        onChange={(event) => addFiles(event.target.files)}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          addFiles(event.dataTransfer.files);
        }}
        className="flex min-h-24 items-center justify-center gap-3 rounded-lg border-2 border-dashed px-4 py-5 text-center outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <FileSpreadsheet className="size-5 text-muted-foreground" aria-hidden="true" />
        <span className="flex flex-col gap-1">
          <span className="font-medium">Drop CSV or Excel files here, or browse</span>
          <span className="text-muted-foreground text-xs">Select multiple files · up to 50 MiB per file</span>
        </span>
      </button>

      {sources.map((source) => {
        const sourceSelected = selected?.fileId === source.id;
        return (
          <div key={source.id} className="flex min-w-0 flex-col gap-3">
            <section className="flex min-w-0 flex-col gap-3 rounded-lg border p-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <label className="sr-only" htmlFor={`dataset-name-${source.id}`}>
                    Dataset name for {source.file.name}
                  </label>
                  <input
                    id={`dataset-name-${source.id}`}
                    className="h-9 min-w-0 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={source.name}
                    maxLength={160}
                    onChange={(event) =>
                      onChange((current) =>
                        current.map((item) => (item.id === source.id ? { ...item, name: event.target.value } : item)),
                      )
                    }
                  />
                  <p className="truncate text-muted-foreground text-xs" title={source.file.name}>
                    {source.file.name} · {formatSize(source.file.size)}
                  </p>
                </div>
                {source.status === "loading" ? (
                  <LoaderCircle className="mt-2 size-4 shrink-0 animate-spin" aria-label="Parsing file" />
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${source.file.name}`}
                    title={`Remove ${source.file.name}`}
                    onClick={() => onChange(removePreviewSource(sources, source.id))}
                  >
                    <X />
                  </Button>
                )}
              </div>

              {source.status === "error" && (
                <p role="alert" className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                  {source.reason}
                </p>
              )}

              {source.tables.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label={`Tables in ${source.file.name}`}>
                  {source.tables.map((table) => (
                    <li key={table.id}>
                      <button
                        type="button"
                        aria-pressed={selected?.id === table.id}
                        onClick={() => setSelectedTableId(table.id)}
                        className="flex flex-col rounded-full border bg-background px-3 py-1.5 text-left text-xs outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-muted"
                      >
                        <span className="max-w-56 truncate font-medium">{table.label}</span>
                        <span className="text-muted-foreground">
                          {table.approximateRows} rows × {table.headers.length} cols
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {source.status === "ready" && source.tables.length === 0 && (
                <p className="text-muted-foreground text-xs">This file contains no tables to preview.</p>
              )}
            </section>

            {source.status === "ready" && sourceSelected && selected && (
              <section className="flex min-w-0 flex-col gap-3" aria-label={`${selected.label} preview`}>
                {selected.headers.length > 0 && selected.rows.length > 0 ? (
                  <div className="max-h-[min(36vh,24rem)] overflow-auto rounded-lg border">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          {previewColumns.map((column) => {
                            const kind = inferColumnKind(selected.rows.map((row) => row[column.index] ?? ""));
                            return (
                              <th key={column.key} className="min-w-28 border-b px-3 py-2 font-medium">
                                <span className="flex items-center gap-1.5">
                                  <ColumnKindIcon kind={kind} className="size-3.5 text-muted-foreground" />
                                  <span className="truncate">{column.header || `Column ${column.index + 1}`}</span>
                                </span>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {previewGridRows.map(({ key, row }) => (
                          <tr key={key} className="border-b last:border-0">
                            {previewColumns.map((column) => (
                              <td
                                key={`${key}:${column.key}`}
                                className="max-w-52 truncate px-3 py-2 text-muted-foreground"
                              >
                                {row[column.index] || "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed px-4 py-6 text-center text-muted-foreground text-sm">
                    {selected.headers.length ? "This table has headers but no data rows." : "This sheet is empty."}
                  </p>
                )}
              </section>
            )}
          </div>
        );
      })}
      {!sources.length && <p className="text-center text-muted-foreground text-sm">No files selected yet.</p>}
    </div>
  );
}
