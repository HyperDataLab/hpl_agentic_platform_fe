import { PLACEHOLDER_ID } from "@/lib/projects/project-id";

import { ProjectSectionPage } from "../_components/project-pages";

// One page for every section, as `_`: the section is read from the URL (see firebase.json).
export const dynamicParams = false;
export function generateStaticParams() {
  return [{ section: PLACEHOLDER_ID }];
}

export default function Page() {
  return <ProjectSectionPage />;
}
