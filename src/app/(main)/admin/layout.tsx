"use client";

import { type ReactNode, useEffect } from "react";

import { useRouter } from "next/navigation";

import { cn } from "cn";

import { AppSidebar } from "@/app/(main)/dashboard/_components/sidebar/app-sidebar";
import { AuthGate } from "@/components/auth/auth-gate";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import { type AuthUser, getRoleHomePath } from "@/lib/auth/auth-config";
import { readPreference, readSidebarOpen } from "@/lib/preferences/client-preference";
import { PlatformRole } from "@/types/enums";

import { NotificationBell } from "../_components/notifications/notification-bell";
import { AccountSwitcher } from "../dashboard/_components/header/account-switcher";
import { LayoutControls } from "../dashboard/_components/header/layout-controls";
import { SearchDialog } from "../dashboard/_components/header/search-dialog";
import { ThemeSwitcher } from "../dashboard/_components/header/theme-switcher";

// Admin is hidden: Google accounts are never platform admins, so everyone is sent on to their projects.
export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return <AuthGate>{(user) => <AdminShell user={user}>{children}</AdminShell>}</AuthGate>;
}

function AdminShell({ user: authenticatedUser, children }: Readonly<{ user: AuthUser; children: ReactNode }>) {
  const router = useRouter();
  const admin = authenticatedUser.platform_role === PlatformRole.PlatformAdmin;
  useEffect(() => {
    if (!admin) router.replace(getRoleHomePath(authenticatedUser.platform_role));
  }, [admin, authenticatedUser.platform_role, router]);
  const defaultOpen = readSidebarOpen();
  const variant = readPreference("sidebar_variant");
  const collapsible = readPreference("sidebar_collapsible");
  if (!admin) return null;

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 68)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        brandLabel={APP_CONFIG.shortName}
        homeUrl="/admin"
        sidebarMode="admin"
        showQuickCreate={false}
        user={{ ...authenticatedUser, avatar: "" }}
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
        <header className="flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex w-full items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-1 lg:gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mx-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
              />
              <SearchDialog />
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <LayoutControls />
              <ThemeSwitcher />
              <AccountSwitcher
                users={[
                  {
                    id: authenticatedUser.email,
                    name: authenticatedUser.name,
                    email: authenticatedUser.email,
                    avatar: "",
                    role: authenticatedUser.platform_role,
                  },
                ]}
              />
            </div>
          </div>
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-4 has-data-[content-padding=false]:p-0 md:p-6 md:has-data-[content-padding=false]:p-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
