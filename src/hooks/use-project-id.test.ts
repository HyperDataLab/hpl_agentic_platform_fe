import { createElement } from "react";

import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { segmentAfter } from "@/lib/projects/project-id";

import { useDatasetId, useProjectId, useProjectSection } from "./use-project-id";

const nav = vi.hoisted(() => ({ pathname: "/", params: {} as Record<string, string | string[]> }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useParams: () => nav.params,
}));

function read<T>(hook: () => T): T {
  let result!: T;
  function Harness() {
    result = hook();
    return null;
  }
  renderToString(createElement(Harness));
  return result;
}

describe("segmentAfter", () => {
  it.each([
    ["/projects/abc", "projects", 1, "abc"],
    ["/projects/abc/experiments", "projects", 2, "experiments"],
    ["/projects/a%20b/datasets/d1", "datasets", 1, "d1"],
    ["/projects/a%20b", "projects", 1, "a b"],
    ["/projects/_", "projects", 1, null],
    ["/projects", "projects", 1, null],
    ["/settings", "projects", 1, null],
    ["/projects/%E0%A4%A", "projects", 1, null],
  ])("%s after %s (+%i) is %s", (path, name, offset, expected) => {
    expect(segmentAfter(path, name, offset)).toBe(expected);
  });
});

describe("useProjectId", () => {
  beforeEach(() => {
    nav.pathname = "/";
    nav.params = {};
  });

  it("reads the real id from the URL while the page was exported as `_`", () => {
    nav.pathname = "/projects/p-42/experiments";
    nav.params = { projectId: "_" };
    expect(read(useProjectId)).toBe("p-42");
    expect(read(useProjectSection)).toBe("experiments");
  });

  it("is empty on the placeholder page itself, before hydration", () => {
    nav.pathname = "/projects/_";
    nav.params = { projectId: "_" };
    expect(read(useProjectId)).toBe("");
  });

  it("falls back to the route params when the path has no project", () => {
    nav.pathname = "/elsewhere";
    nav.params = { projectId: "from-params" };
    expect(read(useProjectId)).toBe("from-params");
  });

  it("reads the dataset of a dataset page", () => {
    nav.pathname = "/projects/p-1/datasets/ds-9";
    nav.params = { projectId: "_", datasetId: "_" };
    expect(read(useDatasetId)).toBe("ds-9");
  });
});
