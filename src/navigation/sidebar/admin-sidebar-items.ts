import {
  Activity,
  Cpu,
  FolderKanban,
  Gauge,
  HeartPulse,
  LayoutDashboard,
  ScrollText,
  Settings,
  Users,
  Waypoints,
} from "lucide-react";

import type { NavGroup } from "./sidebar-items";

/** Admin is hidden: Google accounts are never platform admins. The pages are kept; turning this on shows the menu. */
export const SHOW_ADMIN_NAV = false;

const allAdminSidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "GENERAL",
    items: [
      {
        id: "admin-overview",
        title: "Overview",
        url: "/admin",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: 2,
    label: "MANAGEMENT",
    items: [
      {
        id: "admin-users",
        title: "Users",
        url: "/admin/users",
        icon: Users,
      },
      {
        id: "admin-projects",
        title: "Projects",
        url: "/admin/projects",
        icon: FolderKanban,
      },
    ],
  },
  {
    id: 3,
    label: "AI PLATFORM",
    items: [
      {
        id: "admin-providers",
        title: "Models & Providers",
        url: "/admin/providers",
        icon: Cpu,
      },
      {
        id: "admin-decision-providers",
        title: "Decision Providers",
        url: "/admin/decision-providers",
        icon: Waypoints,
      },
    ],
  },
  {
    id: 4,
    label: "OPERATIONS",
    items: [
      {
        id: "admin-usage",
        title: "Usage & Cost",
        url: "/admin/usage",
        icon: Activity,
      },
      {
        id: "admin-system",
        title: "System Health",
        url: "/admin/system",
        icon: Gauge,
      },
      {
        id: "admin-logs",
        title: "Audit Log",
        url: "/admin/logs",
        icon: ScrollText,
      },
      {
        id: "admin-log-monitoring",
        title: "Log Monitoring",
        url: "/admin/log-monitoring",
        icon: HeartPulse,
      },
    ],
  },
  {
    id: 5,
    label: "SYSTEM",
    items: [
      {
        id: "admin-settings",
        title: "Settings",
        url: "/admin/settings",
        icon: Settings,
      },
    ],
  },
];

export const adminSidebarItems: NavGroup[] = SHOW_ADMIN_NAV ? allAdminSidebarItems : [];
