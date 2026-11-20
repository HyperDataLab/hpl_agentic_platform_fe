"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

import { useDatasetId, useProjectSection } from "@/hooks/use-project-id";
import { getProjectAccess } from "@/lib/auth/project-access";

import { ProjectOverview } from "./project-overview";
import { useWorkspaceProject } from "./project-shell";
import { WorkspaceSection } from "./workspace-section";
import { SectionHeader, WORKSPACE_SECTIONS } from "./workspace-sections";
import { DatasetDetailSkeleton, SectionSkeleton } from "./workspace-skeletons";

export function ProjectOverviewPage() {
  const { project } = useWorkspaceProject();
  return <ProjectOverview project={project} />;
}

/** `/projects/<id>/<section>`, and `experiments`, which has its own route. */
export function ProjectSectionPage({ section: fixed }: { section?: string }) {
  const router = useRouter();
  const { project, user } = useWorkspaceProject();
  const fromUrl = useProjectSection();
  const section = fixed ?? fromUrl;
  const config = Object.hasOwn(WORKSPACE_SECTIONS, section) ? WORKSPACE_SECTIONS[section] : undefined;
  const access = getProjectAccess(project.my_role, project.status);
  let target: string | null = null;
  if (config?.managerOnly && !access.canAccessSettings) target = `/projects/${project.id}`;
  else if (section === "members" && access.canAccessSettings) target = `/projects/${project.id}/settings?tab=access`;

  useEffect(() => {
    if (target) router.replace(target);
  }, [router, target]);

  if (!section || target) return <SectionSkeleton section={section || undefined} />;
  if (!config) {
    return <p className="text-muted-foreground text-sm">This page doesn&apos;t exist in this project.</p>;
  }

  const header = <SectionHeader section={section} />;
  return (
    <div className="flex flex-col gap-6">
      {section !== "members" && section !== "connections" && section !== "files" && section !== "settings" && header}
      <WorkspaceSection
        project={project}
        section={section}
        userId={user.id}
        membersHeader={section === "members" ? header : undefined}
        connectionsHeader={section === "connections" ? header : undefined}
        filesHeader={section === "files" ? header : undefined}
      />
    </div>
  );
}

export function DatasetPage() {
  const { project, user } = useWorkspaceProject();
  const datasetId = useDatasetId();
  if (!datasetId) return <DatasetDetailSkeleton />;
  return <WorkspaceSection project={project} section="dataset-detail" datasetId={datasetId} userId={user.id} />;
}
