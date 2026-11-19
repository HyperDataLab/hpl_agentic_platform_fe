import type { ReactNode } from "react";

import { PLACEHOLDER_ID } from "@/lib/projects/project-id";

import { ProjectShell } from "./_components/project-shell";

// The static export renders one page per route, for the placeholder id `_`. Firebase Hosting serves it for every
// `/projects/<id>/…` (see firebase.json), and the page reads the real id from the URL.
export const dynamicParams = false;
export function generateStaticParams() {
  return [{ projectId: PLACEHOLDER_ID }];
}

export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return <ProjectShell>{children}</ProjectShell>;
}
