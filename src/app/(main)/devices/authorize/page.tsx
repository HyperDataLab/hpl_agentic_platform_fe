import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { getRoleHomePath, LOGIN_PATH } from "@/lib/auth/auth-config";
import { getAuthenticatedUser } from "@/server/auth";

import { TopBarShell } from "../../_components/top-bar-shell";
import { AuthorizeNode } from "../_components/authorize-node";

export const metadata: Metadata = {
  title: "Sign in to Local Node · OpenAI Scientist",
  description: "Approve the Logos Local Node on this computer.",
  robots: { index: false },
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) {
      if (typeof value === "string") query.set(key, value);
    }
    redirect(`${LOGIN_PATH}?${new URLSearchParams({ next: `/devices/authorize?${query}` })}`);
  }
  return (
    <TopBarShell homeUrl={getRoleHomePath(user.platform_role)} user={user}>
      <AuthorizeNode email={user.email} />
    </TopBarShell>
  );
}
