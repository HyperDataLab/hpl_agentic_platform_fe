import type { Metadata } from "next";

import { ProjectOverviewPage } from "./_components/project-pages";

export const metadata: Metadata = {
  title: "Project overview · OpenAI Scientist",
  description: "Datasets, experiments, and findings for this research workspace.",
};

export default function Page() {
  return <ProjectOverviewPage />;
}
