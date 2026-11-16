export type ThumbnailColumnKind = "number" | "date" | "text";

export function thumbnailKind(type: string): ThumbnailColumnKind | "boolean" {
  if (type === "numeric") return "number";
  if (type === "date") return "date";
  if (type === "boolean" || type === "bool") return "boolean";
  return "text";
}

export function missingRatio(missing: number | null, rowCount: number): number | null {
  if (missing === null || rowCount <= 0) return null;
  return Math.max(0, Math.min(1, missing / rowCount));
}

export function thumbnailSummary(
  variables: { type: string; flags: string[]; summary: { n_missing: number | null } }[],
) {
  const counts = new Map<string, number>();
  for (const variable of variables) {
    const kind = thumbnailKind(variable.type);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const kinds = [...counts].map(([kind, count]) => `${count} ${kind === "number" ? "numeric" : kind}`).join(", ");
  const highMissing = variables.filter((variable) => variable.flags.includes("high_missing")).length;
  const columns = variables.length;
  return `${columns} columns${kinds ? ` · ${kinds}` : ""}${highMissing ? ` · ${highMissing} high missing` : ""}`;
}
