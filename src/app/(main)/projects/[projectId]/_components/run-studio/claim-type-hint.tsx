"use client";

import { useQuery } from "@tanstack/react-query";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchClaimTypes, pickClaimTypes } from "@/lib/api/services/fetch-bank";

/**
 * The Writing Bank's claim types related to the chosen kind of run, by name, each with its definition on hover or
 * focus. It renders nothing while loading, when the bank can't be reached, or when none of the ids is in the snapshot.
 */
export function ClaimTypeHint({ ids }: { ids: readonly string[] }) {
  const { data } = useQuery({
    queryKey: ["writing-bank", "claim-types"],
    queryFn: fetchClaimTypes,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const types = pickClaimTypes(ids, data ?? null);
  if (types.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
      <span>Related claim types:</span>
      {types.map((type) => (
        <Tooltip key={type.id}>
          <TooltipTrigger
            type="button"
            className="rounded-md border px-1.5 py-0.5 text-foreground underline-offset-2 hover:bg-muted/60 focus-visible:underline"
          >
            {type.name}
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{type.definition}</TooltipContent>
        </Tooltip>
      ))}
    </p>
  );
}
