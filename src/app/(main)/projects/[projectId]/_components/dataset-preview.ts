export type DatasetPreviewTable = {
  id: string;
  fileId: string;
  label: string;
  headers: string[];
  rows: string[][];
  approximateRows: string;
};

export type DatasetPreviewSource = {
  id: string;
  file: File;
  name: string;
  status: "loading" | "ready" | "error";
  reason?: string;
  tables: DatasetPreviewTable[];
};

export type ColumnKind = "number" | "text" | "date" | "boolean";

export function inferColumnKind(values: readonly string[]): ColumnKind {
  const samples = values.map((value) => value.trim()).filter(Boolean);
  if (!samples.length) return "text";
  if (samples.every((value) => /^(true|false|yes|no)$/i.test(value))) return "boolean";
  if (samples.every((value) => /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(value))) return "number";
  if (
    samples.every(
      (value) => /^\d{4}-\d{1,2}-\d{1,2}(?:[tT ].*)?$/.test(value) || /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(value),
    )
  )
    return "date";
  return "text";
}

/** Removing a source file also removes all of its sheet previews from the upload selection. */
export function removePreviewSource(sources: readonly DatasetPreviewSource[], fileId: string) {
  return sources.filter((source) => source.id !== fileId);
}

export function previewColumnKey(tableId: string, headers: readonly string[], index: number) {
  const sourceHeader = headers[index] || `Column ${index + 1}`;
  const duplicateIndex = headers
    .slice(0, index)
    .filter((header) => (header || "Column") === (headers[index] || "Column")).length;
  return `${tableId}:column:${sourceHeader}:${duplicateIndex}`;
}

export function previewRowKey(tableId: string, rows: readonly string[][], index: number) {
  const row = rows[index] ?? [];
  const signature = JSON.stringify(row);
  const duplicateIndex = rows.slice(0, index).filter((item) => JSON.stringify(item) === signature).length;
  return `${tableId}:row:${signature}:${duplicateIndex}`;
}
