"use client";

import { useSearchParams } from "next/navigation";

import { useAuthUser } from "@/components/auth/auth-gate";
import { canCreateProject } from "@/lib/auth/auth-config";

import { TopBarShell } from "../../_components/top-bar-shell";
import { WorkspaceProjects } from "./workspace-projects";

/** The account's projects. The layout's guard has made sure someone is signed in. */
export function ProjectsPage() {
  const user = useAuthUser();
  const params = useSearchParams();
  if (!user) return null;
  return (
    <TopBarShell homeUrl="/projects" user={user}>
      <WorkspaceProjects
        canCreate={canCreateProject(user.platform_role)}
        initialInvitationsOpen={params.get("tab") === "invitations"}
      />
    </TopBarShell>
  );
}
