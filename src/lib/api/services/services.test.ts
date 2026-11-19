import type { InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ArtifactKind, PlatformRole, ProjectRole, ProjectStatus, RunStatus, UserStatus } from "@/types/enums";

import apiService from "../core";
import { respond, success } from "../test-utils";
import { fetchAdmin } from "./fetch-admin";
import { fetchArtifacts } from "./fetch-artifacts";
import { fetchAuth } from "./fetch-auth";
import { fetchComments } from "./fetch-comments";
import { fetchDatasets } from "./fetch-datasets";
import { fetchInvitations } from "./fetch-invitations";
import { fetchMembers } from "./fetch-members";
import { fetchNotifications } from "./fetch-notifications";

// These paths and verbs come from the backend handoff, including PATCH project and no DELETE project.
const p = "project /1";
const project = "/projects/project%20%2F1";
const run = `${project}/runs/run%2F1`;
const list = { limit: 10, offset: 20 };
const signal = new AbortController().signal;
interface Contract {
  name: string;
  method: string;
  url: string;
  call: () => Promise<unknown>;
  body?: unknown;
  params?: unknown;
  signal?: AbortSignal;
}
const contracts: Contract[] = [
  {
    name: "invite candidates",
    method: "get",
    url: "/projects/project%20%2F1/invite-candidates",
    call: () => fetchMembers.getInviteCandidates(p, { q: "ngo dat", ...list }, signal),
    params: { q: "ngo dat", ...list },
    signal,
  },
  {
    name: "resend project invitation",
    method: "post",
    url: "/projects/project%20%2F1/members/member%2F1/invite",
    call: () => fetchMembers.resendInvite(p, "member/1"),
  },
  {
    name: "list my project invitations",
    method: "get",
    url: "/invitations",
    call: () => fetchInvitations.getList(list, signal),
    params: list,
    signal,
  },
  {
    name: "search project invitations before pagination",
    method: "get",
    url: "/invitations",
    call: () => fetchInvitations.getList({ q: "demo manager", ...list }, signal),
    params: { q: "demo manager", ...list },
    signal,
  },
  {
    name: "accept project invitation",
    method: "post",
    url: "/invitations/member%2F1/accept",
    call: () => fetchInvitations.answer("member/1", "accept"),
  },
  {
    name: "decline project invitation",
    method: "post",
    url: "/invitations/member%2F1/decline",
    call: () => fetchInvitations.answer("member/1", "decline"),
  },
  {
    name: "member list",
    method: "get",
    url: `${project}/members`,
    call: () => fetchMembers.getList(p, list, signal),
    params: list,
    signal,
  },
  {
    name: "add member",
    method: "post",
    url: `${project}/members`,
    call: () => fetchMembers.create(p, { email: "user@example.com", role: ProjectRole.Researcher }),
    body: { email: "user@example.com", role: "researcher" },
  },
  {
    name: "update member",
    method: "put",
    url: `${project}/members/member%2F1`,
    call: () => fetchMembers.update(p, "member/1", { role: ProjectRole.Reviewer }),
    body: { role: "reviewer" },
  },
  {
    name: "remove member",
    method: "delete",
    url: `${project}/members/member%2F1`,
    call: () => fetchMembers.remove(p, "member/1"),
  },
  {
    name: "dataset list",
    method: "get",
    url: `${project}/datasets`,
    call: () => fetchDatasets.getList(p, list, signal),
    params: list,
    signal,
  },
  {
    name: "dataset detail",
    method: "get",
    url: `${project}/datasets/dataset%2F1`,
    call: () => fetchDatasets.getById(p, "dataset/1", signal),
    signal,
  },
  {
    name: "update dataset",
    method: "patch",
    url: `${project}/datasets/dataset%2F1`,
    call: () => fetchDatasets.update(p, "dataset/1", { description: null }),
    body: { description: null },
  },
  {
    name: "dataset versions",
    method: "get",
    url: `${project}/datasets/dataset%2F1/versions`,
    call: () => fetchDatasets.getVersions(p, "dataset/1", list, signal),
    params: list,
    signal,
  },
  {
    name: "artifact list",
    method: "get",
    url: `${run}/artifacts`,
    call: () => fetchArtifacts.getList(p, "run/1", signal),
    signal,
  },
  {
    name: "comment list",
    method: "get",
    url: `${run}/comments`,
    call: () => fetchComments.getList(p, "run/1", { ...list, artifact_id: "artifact" }, signal),
    params: { ...list, artifact_id: "artifact" },
    signal,
  },
  {
    name: "create comment",
    method: "post",
    url: `${run}/comments`,
    call: () => fetchComments.create(p, "run/1", { body: "Review" }),
    body: { body: "Review" },
  },
  {
    name: "update comment",
    method: "patch",
    url: `${run}/comments/comment%2F1`,
    call: () => fetchComments.update(p, "run/1", "comment/1", { body: "Updated" }),
    body: { body: "Updated" },
  },
  {
    name: "remove comment",
    method: "delete",
    url: `${run}/comments/comment%2F1`,
    call: () => fetchComments.remove(p, "run/1", "comment/1"),
  },
  {
    name: "notification list",
    method: "get",
    url: "/notifications",
    call: () => fetchNotifications.getList({ ...list, unread_only: true }, signal),
    params: { ...list, unread_only: true },
    signal,
  },
  {
    name: "unread count",
    method: "get",
    url: "/notifications/unread-count",
    call: () => fetchNotifications.getUnreadCount(signal),
    signal,
  },
  {
    name: "read notification",
    method: "post",
    url: "/notifications/notification%2F1/read",
    call: () => fetchNotifications.markRead("notification/1"),
  },
  {
    name: "read all notifications",
    method: "post",
    url: "/notifications/read-all",
    call: () => fetchNotifications.markAllRead(),
  },
  {
    name: "user list",
    method: "get",
    url: "/users",
    call: () => fetchAdmin.getUsers(list, signal),
    params: list,
    signal,
  },
  {
    name: "search users by name or email",
    method: "get",
    url: "/users",
    call: () => fetchAdmin.getUsers({ q: "demo", status: UserStatus.Active, ...list }, signal),
    params: { q: "demo", status: "active", ...list },
    signal,
  },
  {
    name: "create user",
    method: "post",
    url: "/users",
    call: () => fetchAdmin.createUser({ email: "demo@example.com", display_name: "Demo", send_email: false }),
    body: { email: "demo@example.com", display_name: "Demo", send_email: false },
  },
  {
    name: "resend account sign-in details",
    method: "post",
    url: "/users/user%2F1/invite",
    call: () => fetchAdmin.inviteUser("user/1"),
  },
  {
    name: "edit user profile",
    method: "patch",
    url: "/users/user%2F1",
    call: () => fetchAdmin.updateUserProfile("user/1", { display_name: "Updated" }),
    body: { display_name: "Updated" },
  },
  {
    name: "remove user avatar",
    method: "delete",
    url: "/users/user%2F1/avatar",
    call: () => fetchAdmin.removeUserAvatar("user/1"),
  },
  {
    name: "remove platform admin role",
    method: "put",
    url: "/users/user%2F1/platform-role",
    call: () => fetchAdmin.updatePlatformRole("user/1", { role: PlatformRole.User }),
    body: { role: "user" },
  },
  {
    name: "update user status",
    method: "patch",
    url: "/users/user%2F1/status",
    call: () => fetchAdmin.updateUserStatus("user/1", { status: UserStatus.Suspended }),
    body: { status: "suspended" },
  },
  {
    name: "update platform role",
    method: "put",
    url: "/users/user%2F1/platform-role",
    call: () => fetchAdmin.updatePlatformRole("user/1", { role: PlatformRole.PlatformAdmin }),
    body: { role: "platform_admin" },
  },
  { name: "audit", method: "get", url: "/audit", call: () => fetchAdmin.getAudit(list, signal), params: list, signal },
  {
    name: "usage",
    method: "get",
    url: "/admin/usage/projects",
    call: () => fetchAdmin.getProjectUsage(list, signal),
    params: list,
    signal,
  },
];

describe("API service contracts", () => {
  const adapter = vi.fn<(config: InternalAxiosRequestConfig) => Promise<ReturnType<typeof respond>>>();
  const envelope = {
    ...success([{ id: "row" }]),
    meta: { request_id: "service-request", pagination: { total: 35, limit: 10, offset: 20 } },
  };

  beforeEach(() => {
    adapter.mockReset();
    adapter.mockImplementation(async (config) => respond(config, envelope));
    // Singleton client uses the actual Axios pipeline, with only I/O replaced.
    const request = apiService.request.bind(apiService);
    vi.spyOn(apiService, "request").mockImplementation((config) => request({ ...config, adapter }));
  });

  it.each([true, false])(
    "user toolbar forwards all server filters and preserves email_verified=%s",
    async (verified) => {
      const params = {
        q: "dat ngo",
        status: UserStatus.Active,
        platform_role: PlatformRole.User,
        email_verified: verified,
        limit: 20,
        offset: 40,
      };
      await fetchAdmin.getUsers(params, signal);
      expect(adapter.mock.calls[0][0]).toMatchObject({ url: "/users", method: "get", params, signal });
      expect(adapter.mock.calls[0][0].params).not.toHaveProperty("email");
    },
  );
  it.each(["active", "invited"] as const)(
    "member toolbar forwards q, role, status=%s and server pagination",
    async (status) => {
      const params = { q: "ngo dat", role: ProjectRole.Reviewer, status, limit: 50, offset: 100 };
      await fetchMembers.getList(p, params, signal);
      expect(adapter.mock.calls[0][0]).toMatchObject({ method: "get", url: project + "/members", params, signal });
      expect(adapter.mock.calls[0][0].params).not.toHaveProperty("email");
    },
  );

  it.each(contracts)(
    "$name preserves the backend contract",
    async ({ method, url, call, body, params, signal: expectedSignal }) => {
      const result = await call();
      expect(result).toEqual(envelope);
      expect(adapter).toHaveBeenCalledTimes(1);
      const config = adapter.mock.calls[0][0];
      expect(config).toMatchObject({ method, url });
      expect(config.params).toEqual(params);
      expect(config.signal).toBe(expectedSignal);
      expect(config.data === undefined ? undefined : JSON.parse(config.data as string)).toEqual(body);
    },
  );

  it.each(["own", "admin"])("uploads %s avatar as the file multipart field", async (kind) => {
    const file = new File(["image"], "avatar.png", { type: "image/png" });
    if (kind === "own") await fetchAuth.uploadAvatar(file);
    else await fetchAdmin.uploadUserAvatar("user/1", file);
    const config = adapter.mock.calls[0][0];
    expect(config.url).toBe(kind === "own" ? "/auth/me/avatar" : "/users/user%2F1/avatar");
    expect(config.data).toBeInstanceOf(FormData);
    expect((config.data as FormData).get("file")).toBe(file);
    expect(config.headers.get("Content-Type")).not.toBe("application/json");
  });

  it.each(["dataset", "version"])("uploads a %s as multipart", async (kind) => {
    const file = new File(["a,b\n1,2"], "sample.csv", { type: "text/csv" });
    if (kind === "dataset") await fetchDatasets.create(p, { name: "Sample", description: "", file });
    else await fetchDatasets.createVersion(p, "dataset/1", file);
    const config = adapter.mock.calls[0][0];
    expect(config.method).toBe("post");
    expect(config.url).toBe(kind === "dataset" ? `${project}/datasets` : `${project}/datasets/dataset%2F1/versions`);
    expect(config.data).toBeInstanceOf(FormData);
    const form = config.data as FormData;
    expect(form.get("file")).toBe(file);
    if (kind === "dataset") {
      expect(form.get("name")).toBe("Sample");
      expect(form.get("description")).toBe("");
    }
  });

  it.each(["artifact", "dataset"])("downloads a %s with filename and MIME type", async (kind) => {
    const blob = new Blob(["file"], { type: "application/pdf" });
    adapter.mockImplementation(async (config) =>
      respond(config, blob, 200, {
        "content-disposition": "attachment; filename*=UTF-8''report%20final.pdf",
        "content-type": "application/pdf",
      }),
    );
    const result =
      kind === "artifact"
        ? await fetchArtifacts.download(p, "run/1", "artifact/1", signal)
        : await fetchDatasets.downloadVersion(p, "dataset/1", "version/1", signal);
    expect(result).toEqual({ blob, filename: "report final.pdf", contentType: "application/pdf" });
    expect(adapter.mock.calls[0][0]).toMatchObject({ responseType: "blob", signal, method: "get" });
    expect(adapter.mock.calls[0][0].url).toBe(
      kind === "artifact"
        ? `${run}/artifacts/artifact%2F1/download`
        : `${project}/datasets/dataset%2F1/versions/version%2F1/download`,
    );
  });

  it("enum values serialize to the exact backend values", () => {
    expect(JSON.stringify([ProjectStatus.NeedsReview, RunStatus.AwaitingReview, ArtifactKind.PaperPdf])).toBe(
      '["needs_review","awaiting_review","paper_pdf"]',
    );
  });
});
