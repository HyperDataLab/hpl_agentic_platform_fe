"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

import { AuthGate } from "@/components/auth/auth-gate";
import { type AuthUser, getRoleHomePath } from "@/lib/auth/auth-config";
import { ProjectRole } from "@/types/enums";

import { TopBarShell } from "../../_components/top-bar-shell";
import { ReviewQueue } from "./review-queue";

function Reviews({ user }: { user: AuthUser }) {
  const router = useRouter();
  const reviewer = user.memberships.some((membership) => membership.role === ProjectRole.Reviewer);
  useEffect(() => {
    if (!reviewer) router.replace(getRoleHomePath(user.platform_role));
  }, [reviewer, router, user.platform_role]);
  if (!reviewer) return null;
  return (
    <TopBarShell homeUrl="/reviews" user={user}>
      <ReviewQueue />
    </TopBarShell>
  );
}

/** The review queue, for reviewers of some project. Projects have no reviewers yet, so it sends people on. */
export function ReviewsPage() {
  return <AuthGate>{(user) => <Reviews user={user} />}</AuthGate>;
}
