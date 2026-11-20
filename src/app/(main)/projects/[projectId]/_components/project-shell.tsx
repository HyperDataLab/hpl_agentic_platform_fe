"use client";

import { createContext, type ReactNode, useContext, useEffect } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";

import { useAuthUser } from "@/components/auth/auth-gate";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useProjectId } from "@/hooks/use-project-id";
import { useProjectDetailQuery, useProjectsQuery } from "@/hooks/use-projects-query";
import type { ProjectItem } from "@/lib/api/services/fetch-project";
import { type AuthUser, canCreateProject } from "@/lib/auth/auth-config";
import { readPreference, readSidebarOpen } from "@/lib/preferences/client-preference";
import { ApiError } from "@/types/api";

import { LlmSettingsButton } from "../../../_components/llm-settings-button";
import { AccountSwitcher } from "../../../dashboard/_components/header/account-switcher";
import { LayoutControls } from "../../../dashboard/_components/header/layout-controls";
import { ThemeSwitcher } from "../../../dashboard/_components/header/theme-switcher";
import { WorkspaceShellSkeleton } from "../../_components/workspace-shell-skeleton";
import { ProjectSidebar } from "./project-sidebar";
import { RememberLastProject } from "./remember-last-project";
import { RunWorkspaceHost } from "./run-studio/run-workspace";

interface ProjectContextValue {
  project: ProjectItem;
  user: AuthUser;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

/** The project the page is in, read from the worker by the layout, and the signed-in account. */
export function useWorkspaceProject() {
  const value = useContext(ProjectContext);
  if (!value) throw new Error("useWorkspaceProject must be used inside a project page.");
  return value;
}

function ProjectMissing({ title, text }: { title: string; text: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{text}</EmptyDescription>
        </EmptyHeader>
        <Button asChild variant="outline">
          <Link href="/projects">Back to projects</Link>
        </Button>
      </Empty>
    </main>
  );
}

/**
 * A project's frame: its sidebar, header and run studio. The static export has one page for every project (`_`), so
 * the project comes from the URL, and its record from the worker, in the browser.
 */
export function ProjectShell({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const projectId = useProjectId();
  const user = useAuthUser(projectId);
  const projectQuery = useProjectDetailQuery(projectId, { enabled: Boolean(user) });
  const projectsQuery = useProjectsQuery({ include_archived: true }, { enabled: Boolean(user) });
  const project = projectQuery.data?.data;
  const error = projectQuery.error;
  const denied = error instanceof ApiError && error.status === 403;

  // A project the account isn't a member of: back to the list, as the Platform did.
  useEffect(() => {
    if (denied || (project && !project.my_role)) router.replace("/projects");
  }, [denied, project, router]);

  if (error instanceof ApiError && error.status === 404) {
    return <ProjectMissing title="Project not found" text="It may have been deleted, or the link is wrong." />;
  }
  if (error && !denied) {
    return <ProjectMissing title="Unable to open the project" text={error.message} />;
  }
  if (!user || !project?.my_role) return <WorkspaceShellSkeleton />;

  const defaultOpen = readSidebarOpen();
  const variant = readPreference("sidebar_variant");
  const collapsible = readPreference("sidebar_collapsible");
  const projects = projectsQuery.data?.data ?? [project];

  return (
    <ProjectContext.Provider value={{ project, user }}>
      <SidebarProvider
        defaultOpen={defaultOpen}
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 68)",
          } as React.CSSProperties
        }
      >
        <RememberLastProject projectId={project.id} userId={user.id} />
        <RunWorkspaceHost projectId={project.id} />
        <ProjectSidebar
          activeProject={project}
          canCreate={canCreateProject(user.platform_role)}
          projects={projects}
          user={user}
          variant={variant}
          collapsible={collapsible}
        />
        <SidebarInset
          className={cn(
            "min-w-0 overflow-x-clip [--dashboard-header-height:--spacing(12)] peer-data-[variant=inset]:border",
            "[html[data-content-layout=centered]_&>*]:mx-auto [html[data-content-layout=centered]_&>*]:w-full",
            "[html[data-content-layout=centered]_&>*]:max-w-screen-2xl",
          )}
        >
          <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex w-full items-center justify-between gap-2 px-4 lg:px-6">
              <div className="flex min-w-0 items-center gap-1 lg:gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator
                  orientation="vertical"
                  className="mx-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
                />
                <span className="truncate font-medium text-sm">{project.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <LlmSettingsButton />
                <LayoutControls />
                <ThemeSwitcher />
                <AccountSwitcher
                  users={[{ id: user.email, name: user.name, email: user.email, avatar: "", role: user.platform_role }]}
                />
              </div>
            </div>
          </header>
          <div className="min-h-0 min-w-0 flex-1 overflow-x-clip p-4 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </ProjectContext.Provider>
  );
}
