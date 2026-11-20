import Link from "next/link";

import { Cpu } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Opens Settings → Language model (the 9router endpoint, key and models). Kept apart from the layout preferences,
 * which sit behind the gear next to it. The label shows from small screens up; phones get the icon.
 */
export function LlmSettingsButton() {
  return (
    <Button asChild variant="ghost" size="sm" aria-label="Language model settings">
      <Link prefetch={false} href="/settings">
        <Cpu aria-hidden="true" data-icon="inline-start" />
        <span className="max-sm:hidden">Language model</span>
      </Link>
    </Button>
  );
}
