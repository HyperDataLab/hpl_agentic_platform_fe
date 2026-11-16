import { notFound, redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/server/auth";
import { getWorkspaceProject } from "@/server/projects";

import { DatasetRunView } from "../../../../_components/dataset-run/dataset-run-view";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string; datasetId: string; runId: string }>;
}) {
  const { projectId, datasetId, runId } = await params;
  const user = await getAuthenticatedUser(projectId);
  if (!user) redirect("/auth/login");
  const project = await getWorkspaceProject(projectId);
  if (!project) notFound();

  return <DatasetRunView projectId={project.id} datasetId={datasetId} runId={runId} />;
}
