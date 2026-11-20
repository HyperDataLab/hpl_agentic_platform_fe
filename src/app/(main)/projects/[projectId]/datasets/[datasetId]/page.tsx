import { PLACEHOLDER_ID } from "@/lib/projects/project-id";

import { DatasetPage } from "../../_components/project-pages";

export const dynamicParams = false;
export function generateStaticParams() {
  return [{ datasetId: PLACEHOLDER_ID }];
}

export default function Page() {
  return <DatasetPage />;
}
