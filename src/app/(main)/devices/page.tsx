import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { getRoleHomePath, LOGIN_PATH } from "@/lib/auth/auth-config";
import { getAuthenticatedUser } from "@/server/auth";

import { TopBarShell } from "../_components/top-bar-shell";
import { MyDevices } from "./_components/my-devices";

export const metadata: Metadata = {
  title: "Local Nodes · OpenAI Scientist",
  description: "Computers signed in to your account with Logos Local Node.",
};

export default async function Page() {
  const user = await getAuthenticatedUser();
  if (!user) redirect(`${LOGIN_PATH}?${new URLSearchParams({ next: "/devices" })}`);
  return (
    <TopBarShell homeUrl={getRoleHomePath(user.platform_role)} user={user}>
      <MyDevices />
    </TopBarShell>
  );
}
