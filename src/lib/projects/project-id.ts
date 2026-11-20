/** The id every `projects/[projectId]` page is exported with. Firebase serves it for every real project id. */
export const PLACEHOLDER_ID = "_";

/**
 * Reads a dynamic segment from a path: `segmentAfter("/projects/abc/runs", "projects")` is `abc`. Returns null when
 * the path has no such segment, or only the export's placeholder.
 */
export function segmentAfter(pathname: string | null | undefined, name: string, offset = 1): string | null {
  if (!pathname) return null;
  const parts = pathname.split("?")[0].split("#")[0].split("/").filter(Boolean);
  const index = parts.indexOf(name);
  if (index < 0) return null;
  const raw = parts[index + offset];
  if (!raw) return null;
  let value: string;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return value && value !== PLACEHOLDER_ID ? value : null;
}
