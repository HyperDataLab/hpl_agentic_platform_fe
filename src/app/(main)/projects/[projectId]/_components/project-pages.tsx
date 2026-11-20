"use client";

import { useEffect } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useDatasetId, useProjectSection } from "@/hooks/use-project-id";
import { getProjectAccess } from "@/lib/auth/project-access";
import { I2H_SECTIONS, SHOW_PLATFORM_SECTIONS } from "@/navigation/sidebar/project-sidebar-items";

import { ProjectOverview } from "./project-overview";
import { useWorkspaceProject } from "./project-shell";
import { WorkspaceSection } from "./workspace-section";
import { SectionHeader, WORKSPACE_SECTIONS } from "./workspace-sections";
import { DatasetDetailSkeleton, SectionSkeleton } from "./workspace-skeletons";

export function ProjectOverviewPage() {
  const { project } = useWorkspaceProject();
  return <ProjectOverview project={project} />;
}

/** A section the old Platform API served, opened from an old link: the i2h-worker has no routes for it. */
function SectionUnavailable({ projectId }: { projectId: string }) {
  return (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyTitle>Not available here yet</EmptyTitle>
        <EmptyDescription>
          This part of the project isn&apos;t part of idea2hypothesis yet. The model and key runs use are under Language
          model.
        </EmptyDescription>
      </EmptyHeader>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href={`/projects/${projectId}/experiments`}>Research flow</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/settings">Language model</Link>
        </Button>
      </div>
    </Empty>
  );
}

/** `/projects/<id>/<section>`, and `experiments`, which has its own route. */
export function ProjectSectionPage({ section: fixed }: { section?: string }) {
  const router = useRouter();
  const { project, user } = useWorkspaceProject();
  const fromUrl = useProjectSection();
  const section = fixed ?? fromUrl;
  const config = Object.hasOwn(WORKSPACE_SECTIONS, section) ? WORKSPACE_SECTIONS[section] : undefined;
  const available = SHOW_PLATFORM_SECTIONS || I2H_SECTIONS.has(section);
  const access = getProjectAccess(project.my_role, project.status);
  let target: string | null = null;
  // Sections the worker doesn't serve show a notice instead of sending people on.
  if (available && config?.managerOnly && !access.canAccessSettings) target = `/projects/${project.id}`;
  else if (available && section === "members" && access.canAccessSettings)
    target = `/projects/${project.id}/settings?tab=access`;

  useEffect(() => {
    if (target) router.replace(target);
  }, [router, target]);

  if (section && config && !available) return <SectionUnavailable projectId={project.id} />;
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
  if (!SHOW_PLATFORM_SECTIONS) return <SectionUnavailable projectId={project.id} />;
  if (!datasetId) return <DatasetDetailSkeleton />;
  return <WorkspaceSection project={project} section="dataset-detail" datasetId={datasetId} userId={user.id} />;
}
