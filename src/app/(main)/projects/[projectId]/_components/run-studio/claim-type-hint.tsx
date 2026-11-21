"use client";

import { useQuery } from "@tanstack/react-query";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchClaimTypes, fetchFramings, pickClaimTypes, pickFramings } from "@/lib/api/services/fetch-bank";

type Chip = { id: string; name: string; definition: string; example?: string };

function ChipGroup({ label, chips }: { label: string; chips: Chip[] }) {
  if (chips.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
      <span>{label}:</span>
      {chips.map((chip) => (
        <Tooltip key={chip.id}>
          <TooltipTrigger
            type="button"
            className="rounded-md border px-1.5 py-0.5 text-foreground underline-offset-2 hover:bg-muted/60 focus-visible:underline"
          >
            {chip.name}
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            {chip.definition}
            {chip.example && <span className="mt-1 block opacity-80">e.g. {chip.example}</span>}
          </TooltipContent>
        </Tooltip>
      ))}
    </p>
  );
}

/**
 * The Writing Bank's framing types (objective, question, hypothesis) and claim types related to the chosen kind of
 * run, by name, each with its definition on hover or focus. A group renders nothing while loading, when the bank
 * can't be reached, or when none of its ids is in the snapshot.
 */
export function ClaimTypeHint({ ids, framingIds = [] }: { ids: readonly string[]; framingIds?: readonly string[] }) {
  const claims = useQuery({
    queryKey: ["writing-bank", "claim-types"],
    queryFn: fetchClaimTypes,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const framings = useQuery({
    queryKey: ["writing-bank", "framing-types"],
    queryFn: fetchFramings,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  return (
    <div className="grid gap-1">
      <ChipGroup label="Framing" chips={pickFramings(framingIds, framings.data ?? null)} />
      <ChipGroup label="Claim types" chips={pickClaimTypes(ids, claims.data ?? null)} />
    </div>
  );
}
