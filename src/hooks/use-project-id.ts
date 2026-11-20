"use client";

import { useParams, usePathname } from "next/navigation";

import { PLACEHOLDER_ID, segmentAfter } from "@/lib/projects/project-id";

/**
 * A dynamic segment of the current page. The static export renders `projects/[projectId]` once, as `_`, and Firebase
 * serves that page for every project; the real id is only in the browser's URL, which `usePathname` reads.
 */
function useSegment(param: string, after: string, offset = 1): string {
  const pathname = usePathname();
  const params = useParams<Record<string, string | string[]>>();
  const fromPath = segmentAfter(pathname, after, offset);
  if (fromPath) return fromPath;
  const value = params?.[param];
  const fromParams = Array.isArray(value) ? value[0] : value;
  return fromParams && fromParams !== PLACEHOLDER_ID ? fromParams : "";
}

/** The project the page is about, or "" while the static placeholder is shown (before hydration). */
export function useProjectId() {
  return useSegment("projectId", "projects");
}

/** The section of a project page: `/projects/<id>/<section>`. */
export function useProjectSection() {
  return useSegment("section", "projects", 2);
}

/** The dataset of `/projects/<id>/datasets/<datasetId>`. */
export function useDatasetId() {
  return useSegment("datasetId", "datasets");
}
