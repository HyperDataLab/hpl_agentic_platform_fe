import { Badge } from "@/components/ui/badge";
import type { CapabilityManifest } from "@/lib/api/services/fetch-local-nodes";

const FAMILY_LABELS = new Map([
  ["table_row_count", "Row count"],
  ["missingness_band", "Missing data bands"],
  ["distribution_band", "Distribution bands"],
  ["rank_correlation", "Rank correlation"],
  ["data_card", "Data card"],
  ["table_quality", "Table quality"],
  ["key_uniqueness", "Key uniqueness"],
  ["table_fingerprint", "Table fingerprint"],
]);

export function NodeCapabilities({ capabilities }: { capabilities: CapabilityManifest | null | undefined }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs">Can compute</span>
        {capabilities == null && (
          <p className="text-muted-foreground text-xs">
            Not reported. Update the Local Node to see what it can compute.
          </p>
        )}
        {capabilities?.families.map(({ family }) => (
          <Badge key={family} variant="outline" className="max-w-full" title={family}>
            <span className="truncate">{FAMILY_LABELS.get(family) ?? family}</span>
          </Badge>
        ))}
        {capabilities?.families.length === 0 && (
          <span className="text-muted-foreground text-xs">No compute families reported.</span>
        )}
      </div>
      {capabilities != null && (
        <p className="text-muted-foreground text-xs">
          Isolation: {capabilities.isolation === "appcontainer" ? "AppContainer" : "None"}
          {capabilities.floors.min_cell != null && ` · min cell ${capabilities.floors.min_cell}`}
        </p>
      )}
    </div>
  );
}
