import { ApiError, type ApiResult } from "@/types/api";
import { ProjectRole, ProjectStatus } from "@/types/enums";

import type { ListParams } from "../types";
import { type WorkerProject, workerProjects } from "./worker-store";

export { ProjectStatus } from "@/types/enums";

export interface ProjectItem {
  id: string;
  name: string;
  description: string | null;
  domain: string | null;
  objective: string | null;
  tags: string[];
  status: ProjectStatus;
  owner_user_id: string;
  my_role: ProjectRole | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string | null;
  domain?: string | null;
  objective?: string | null;
  tags?: string[];
}

export type UpdateProjectRequest = Partial<CreateProjectRequest>;

export interface ProjectListParams extends ListParams {
  include_archived?: boolean;
}

export type ProjectListResponse = ApiResult<ProjectItem[]>;
export type ProjectDetailResponse = ApiResult<ProjectItem>;

export type Project = ProjectItem;

const ok = <T>(data: T, total?: number): ApiResult<T> => ({
  success: true,
  message: "OK",
  data,
  meta: { request_id: "", pagination: total === undefined ? null : { total, limit: total, offset: 0 } },
});

const STATUSES = new Set<string>(Object.values(ProjectStatus));

function roleOf(owner: boolean, member: boolean) {
  if (owner) return ProjectRole.ProjectManager;
  return member ? ProjectRole.Researcher : null;
}

/** A project as the app shows it, from the worker's record. The owner manages it; other members research. */
export function toProjectItem(project: WorkerProject, email: string | null): ProjectItem {
  const me = email?.toLowerCase() ?? "";
  const owner = project.owner_email.toLowerCase() === me;
  const member = project.member_emails.some((item) => item.toLowerCase() === me);
  return {
    id: project.id,
    name: project.name,
    description: project.description || null,
    domain: null,
    objective: null,
    tags: [],
    status: STATUSES.has(project.status) ? (project.status as ProjectStatus) : ProjectStatus.Researching,
    owner_user_id: project.owner_email,
    my_role: roleOf(owner, member),
    created_at: project.created_at,
    updated_at: project.updated_at,
  };
}

/** The signed-in account's email: the worker keeps members by email. */
async function me() {
  const { currentEmail, getIdToken } = await import("@/lib/firebase/client");
  await getIdToken();
  const email = currentEmail();
  if (!email) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return email;
}

const shown = async (project: WorkerProject) => ok(toProjectItem(project, await me()));
const setStatus = async (id: string, status: WorkerProject["status"]) =>
  shown(await workerProjects.update(id, { status }));

/** Projects and their members are kept by the i2h-worker in Cloudflare D1; a project is reached by its members only. */
export const fetchProject = {
  transferOwnership: async (id: string, newOwnerEmail: string): Promise<ProjectDetailResponse> =>
    shown(await workerProjects.update(id, { owner_email: newOwnerEmail })),
  remove: async (id: string): Promise<ApiResult<null>> => {
    await workerProjects.remove(id);
    return ok(null);
  },
  /** Every project the account belongs to: there are few, so there is one page. */
  getList: async (params?: ProjectListParams, signal?: AbortSignal): Promise<ProjectListResponse> => {
    const [email, list] = await Promise.all([me(), workerProjects.list(signal)]);
    const projects = list
      .map((project) => toProjectItem(project, email))
      .filter((project) => (params?.include_archived ?? false) || project.status !== ProjectStatus.Archived);
    return ok(projects, projects.length);
  },
  getById: async (id: string, signal?: AbortSignal): Promise<ProjectDetailResponse> =>
    shown(await workerProjects.get(id, signal)),
  create: async (data: CreateProjectRequest): Promise<ProjectDetailResponse> =>
    shown(await workerProjects.create({ name: data.name.trim(), description: data.description?.trim() ?? "" })),
  update: async (id: string, data: UpdateProjectRequest): Promise<ProjectDetailResponse> =>
    shown(
      await workerProjects.update(id, {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() ?? "" } : {}),
      }),
    ),
  /** Adds a lab account to the project (owner only). */
  addMember: async (id: string, email: string): Promise<ProjectDetailResponse> =>
    shown(await workerProjects.addMember(id, email)),
  removeMember: async (id: string, email: string): Promise<ProjectDetailResponse> =>
    shown(await workerProjects.removeMember(id, email)),
  archive: (id: string) => setStatus(id, "archived"),
  restore: (id: string) => setStatus(id, "researching"),
  complete: (id: string) => setStatus(id, "completed"),
  reopen: (id: string) => setStatus(id, "researching"),
};
