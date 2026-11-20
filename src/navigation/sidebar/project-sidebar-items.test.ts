import { describe, expect, it } from "vitest";

import { ProjectRole } from "@/types/enums";

import { getProjectSidebarItems } from "./project-sidebar-items";

describe("project settings navigation", () => {
  it.each([
    [ProjectRole.ProjectManager, true],
    [ProjectRole.Researcher, false],
    [ProjectRole.Reviewer, false],
    [null, false],
  ] as const)("shows Settings for %s: %s", (role, visible) => {
    const items = getProjectSidebarItems("project", role, true).flatMap((group) => group.items);
    expect(items.some((item) => item.id === "project-settings")).toBe(visible);
  });

  it("shows only what the i2h-worker serves, and the language model settings", () => {
    const items = getProjectSidebarItems("p", ProjectRole.ProjectManager).flatMap((group) => group.items);
    expect(items.map((item) => item.id)).toEqual(["project-overview", "project-experiments", "llm-settings"]);
    expect(items.find((item) => item.id === "llm-settings")).toMatchObject({ url: "/settings" });
  });
});
