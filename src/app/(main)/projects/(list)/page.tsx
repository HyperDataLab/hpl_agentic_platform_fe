import { Suspense } from "react";

import type { Metadata } from "next";

import { ProjectsPage } from "../_components/projects-page";

export const metadata: Metadata = {
  title: "Projects · OpenAI Scientist",
  description: "Choose a research workspace to continue.",
};

export default function Page() {
  return (
    <Suspense>
      <ProjectsPage />
    </Suspense>
  );
}
