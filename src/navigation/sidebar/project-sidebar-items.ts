import { Cpu, Database, FileText, LayoutDashboard, Plug, Settings, Users, Workflow } from "lucide-react";

import { ProjectRole } from "@/types/enums";

import type { NavGroup } from "./sidebar-items";

/**
 * Project sections the old Platform API served: datasets, data connections, documents, members and project settings.
 * The i2h-worker has none of their routes, so they are hidden; the pages are kept, and turning this on brings them back.
 */
export const SHOW_PLATFORM_SECTIONS = false;

/** Project sections the i2h-worker serves. */
export const I2H_SECTIONS: ReadonlySet<string> = new Set(["experiments"]);

export function getProjectSidebarItems(
  projectId: string,
  role: ProjectRole | null,
  platformSections = SHOW_PLATFORM_SECTIONS,
): NavGroup[] {
  const baseUrl = `/projects/${projectId}`;
  // The 9router endpoint, key and models runs use: kept in this browser, for every project.
  const languageModel = { id: "llm-settings", title: "Language model", url: "/settings", icon: Cpu };

  if (!platformSections) {
    return [
      { id: 1, items: [{ id: "project-overview", title: "Overview", url: baseUrl, icon: LayoutDashboard }] },
      {
        id: 2,
        label: "RESEARCH",
        items: [
          {
            id: "project-experiments",
            title: "Research flow",
            url: `${baseUrl}/experiments`,
            icon: Workflow,
            activeMatch: "prefix",
          },
        ],
      },
      { id: 4, label: "SETTINGS", items: [languageModel] },
    ];
  }

  return [
    {
      id: 1,
      items: [{ id: "project-overview", title: "Overview", url: baseUrl, icon: LayoutDashboard }],
    },
    {
      id: 2,
      label: "RESEARCH",
      items: [
        // The route keeps its old name so existing links still work.
        {
          id: "project-experiments",
          title: "Research flow",
          url: `${baseUrl}/experiments`,
          icon: Workflow,
          activeMatch: "prefix",
        },
      ],
    },
    {
      id: 3,
      label: "LIBRARY",
      items: [
        {
          id: "project-datasets",
          title: "Datasets",
          url: `${baseUrl}/datasets`,
          icon: Database,
          activeMatch: "prefix",
        },
        {
          id: "project-connections",
          title: "Data Connections",
          url: `${baseUrl}/connections`,
          icon: Plug,
          activeMatch: "prefix",
        },
        { id: "project-files", title: "Documents", url: `${baseUrl}/files`, icon: FileText },
      ],
    },
    {
      id: 4,
      label: "PROJECT",
      items: [
        ...(role === ProjectRole.ProjectManager
          ? [{ id: "project-settings", title: "Settings", url: `${baseUrl}/settings`, icon: Settings }]
          : [{ id: "project-members", title: "Members", url: `${baseUrl}/members`, icon: Users }]),
        languageModel,
      ],
    },
  ];
}
