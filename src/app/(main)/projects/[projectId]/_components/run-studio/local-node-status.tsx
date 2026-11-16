import { Clock, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { RunState } from "@/lib/run-stream/run-state";

export const RELEASE_REVIEW_MESSAGE = "Waiting for release review on the Local Node.";

export function SupersededDatasetBanner({
  state,
}: {
  state: Pick<RunState, "dataset_superseded" | "superseded_by_version">;
}) {
  if (state.dataset_superseded !== true) return null;
  return (
    <div className="border-b px-4 py-3 md:px-8">
      <Alert role="status">
        <TriangleAlert aria-hidden="true" />
        <AlertDescription>
          This run uses an older version of the dataset. Its results stay in history;{" "}
          {state.superseded_by_version === undefined
            ? "a newer version exists."
            : `v${state.superseded_by_version} is available.`}
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function LocalNodeWaitBanner({ state }: { state: Pick<RunState, "lifecycle" | "pauseReason"> }) {
  if (state.lifecycle !== "paused" || state.pauseReason !== "runner_offline") return null;
  return (
    <div className="border-b px-4 py-3 md:px-8">
      <Alert role="status">
        <Clock aria-hidden="true" />
        <AlertDescription>Waiting for the Local Node. The run continues when it reconnects.</AlertDescription>
      </Alert>
    </div>
  );
}

/** The release review remains ordinary progress, rather than a gate or an error. */
export function ReleaseReviewIcon({ text }: { text: string }) {
  if (text !== RELEASE_REVIEW_MESSAGE) return null;
  return <Clock aria-hidden="true" className="mr-1.5 inline size-4 align-text-bottom text-muted-foreground" />;
}

export function RunFailureMessage({ message, code }: { message?: string; code?: string }) {
  const capability = code === "LOCAL_NODE_CAPABILITY";
  return (
    <>
      {message ?? "Popper could not finish this run."}
      {capability ? (
        <span className="mt-2 flex items-center gap-1.5 font-medium text-foreground">
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-amber-500" />
          Update the Local Node
        </span>
      ) : (
        " Use the stages above to look back at what was done."
      )}
    </>
  );
}
