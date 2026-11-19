import { ApiError, type ApiResult } from "@/types/api";
import { ProjectRole, ProjectStatus } from "@/types/enums";

import type { ListParams } from "../types";
import { firestoreProjects, type ProjectDoc } from "./firestore-store";

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

/** A project as the app shows it, from its Firestore document. The owner manages it; other members research. */
export function toProjectItem(id: string, project: ProjectDoc, email: string | null): ProjectItem {
  const me = email?.toLowerCase() ?? "";
  const owner = project.ownerEmail.toLowerCase() === me;
  const member = project.memberEmails.some((item) => item.toLowerCase() === me);
  return {
    id,
    name: project.name,
    description: project.description || null,
    domain: null,
    objective: null,
    tags: [],
    status:
      project.status && STATUSES.has(project.status) ? (project.status as ProjectStatus) : ProjectStatus.Researching,
    owner_user_id: project.ownerEmail,
    my_role: roleOf(owner, member),
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  };
}

async function me() {
  const { currentEmail, getIdToken } = await import("@/lib/firebase/client");
  await getIdToken();
  const email = currentEmail();
  if (!email) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return email;
}

async function byId(id: string): Promise<ProjectDetailResponse> {
  const email = await me();
  const project = await firestoreProjects.get(id);
  if (!project) throw new ApiError(404, "NOT_FOUND", "This project no longer exists.");
  return ok(toProjectItem(id, project, email));
}

async function setStatus(id: string, status: ProjectStatus) {
  await firestoreProjects.update(id, { status });
  return byId(id);
}

/** Projects live in Firestore (`projects/{id}`); members are listed by email in `memberEmails`. */
export const fetchProject = {
  transferOwnership: async (id: string, newOwnerEmail: string): Promise<ProjectDetailResponse> => {
    await firestoreProjects.update(id, { ownerEmail: newOwnerEmail });
    return byId(id);
  },
  remove: async (id: string): Promise<ApiResult<null>> => {
    await firestoreProjects.remove(id);
    return ok(null);
  },
  /** Every project the account belongs to: there are few, so there is one page. */
  getList: async (params?: ProjectListParams, _signal?: AbortSignal): Promise<ProjectListResponse> => {
    const email = await me();
    const projects = (await firestoreProjects.list(email))
      .map(({ id, doc }) => toProjectItem(id, doc, email))
      .filter((project) => params?.include_archived || project.status !== ProjectStatus.Archived);
    return ok(projects, projects.length);
  },
  getById: async (id: string, _signal?: AbortSignal): Promise<ProjectDetailResponse> => byId(id),
  create: async (data: CreateProjectRequest): Promise<ProjectDetailResponse> => {
    const email = await me();
    const id = await firestoreProjects.create({
      name: data.name.trim(),
      description: data.description?.trim() ?? "",
      ownerEmail: email,
    });
    return byId(id);
  },
  update: async (id: string, data: UpdateProjectRequest): Promise<ProjectDetailResponse> => {
    await firestoreProjects.update(id, {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() ?? "" } : {}),
    });
    return byId(id);
  },
  archive: (id: string) => setStatus(id, ProjectStatus.Archived),
  restore: (id: string) => setStatus(id, ProjectStatus.Researching),
  complete: (id: string) => setStatus(id, ProjectStatus.Completed),
  reopen: (id: string) => setStatus(id, ProjectStatus.Researching),
};
