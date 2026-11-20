import type { Metadata } from "next";

import { AdminProjects } from "../_components/admin-projects";

export const metadata: Metadata = {
  title: "Projects · OpenAI Scientist",
  description: "Review and manage OpenAI Scientist research projects.",
};

// A static export has no query string at build time: the grid shows. (Admin is hidden from the navigation.)
export default function Page() {
  return <AdminProjects activeView="grid" />;
}
