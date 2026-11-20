import { describe, expect, it, vi } from "vitest";

import { ProjectRole, ProjectStatus } from "@/types/enums";

import apiService from "../core";
import { fetchProject, toProjectItem } from "./fetch-project";
import type { WorkerProject } from "./worker-store";

vi.mock("@/lib/firebase/client", () => ({
  getIdToken: async () => "id-token",
  currentEmail: () => "Alice@HyperDataLab.org",
}));

const project: WorkerProject = {
  id: "prj-1",
  name: "BM25 fusion",
  description: "",
  owner_email: "alice@hyperdatalab.org",
  member_emails: ["alice@hyperdatalab.org", "bob@hyperdatalab.org"],
  status: "archived",
  created_at: "2026-11-20T00:00:00.000Z",
  updated_at: "2026-11-20T00:01:00.000Z",
};

describe("projects from the worker (D1)", () => {
  it.each([
    ["alice@hyperdatalab.org", ProjectRole.ProjectManager],
    ["BOB@hyperdatalab.org", ProjectRole.Researcher],
    ["carol@hyperdatalab.org", null],
    [null, null],
  ])("gives %s the role %s", (email, role) => {
    expect(toProjectItem(project, email)).toMatchObject({
      id: "prj-1",
      description: null,
      owner_user_id: "alice@hyperdatalab.org",
      status: ProjectStatus.Archived,
      my_role: role,
    });
  });

  it("lists the caller's projects and hides archived ones unless asked", async () => {
    const get = vi.spyOn(apiService, "get").mockResolvedValue({ data: { projects: [project] } } as never);
    expect((await fetchProject.getList()).data).toEqual([]);
    const all = await fetchProject.getList({ include_archived: true });
    expect(all.data.map((item) => item.my_role)).toEqual([ProjectRole.ProjectManager]);
    expect(get).toHaveBeenCalledWith("/projects", undefined, { signal: undefined });
  });

  it("sends edits, status changes, hand-overs and members to the project's routes", async () => {
    const patch = vi.spyOn(apiService, "patch").mockResolvedValue({ data: project } as never);
    const post = vi.spyOn(apiService, "post").mockResolvedValue({ data: project } as never);
    await fetchProject.update("prj-1", { name: " New name ", description: null });
    await fetchProject.archive("prj-1");
    await fetchProject.transferOwnership("prj-1", "bob@hyperdatalab.org");
    await fetchProject.addMember("prj-1", "bob@hyperdatalab.org");
    expect(patch.mock.calls).toEqual([
      ["/projects/prj-1", { name: "New name", description: "" }],
      ["/projects/prj-1", { status: "archived" }],
      ["/projects/prj-1", { owner_email: "bob@hyperdatalab.org" }],
    ]);
    expect(post).toHaveBeenCalledWith("/projects/prj-1/members", { email: "bob@hyperdatalab.org" });
  });
});
