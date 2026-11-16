import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CapabilityManifest } from "@/lib/api/services/fetch-local-nodes";

import { NodeCapabilities } from "./node-capabilities";

const manifest: CapabilityManifest = {
  contract_version: "1",
  node_version: "0.1.0",
  families: [
    { family: "table_row_count", kind: "table", op: "hash", scopes: ["whole"], max_calls: 1 },
    { family: "missingness_band", kind: "table", op: "quality", scopes: ["whole"], max_calls: 1 },
    { family: "distribution_band", kind: "table", op: "relations", scopes: ["exploration"], max_calls: 1 },
    { family: "rank_correlation", kind: "table", op: "relations", scopes: ["confirmation"], max_calls: 1 },
    { family: "data_card", kind: "profile", op: null, scopes: ["whole"], max_calls: 1 },
  ],
  floors: { min_cell: 5, k_min: 5 },
  isolation: "appcontainer",
};

const render = (capabilities: CapabilityManifest | null | undefined) =>
  renderToStaticMarkup(createElement(NodeCapabilities, { capabilities }));

describe("NodeCapabilities", () => {
  it("labels the D3 families", () => {
    const html = render({
      ...manifest,
      families: ["table_quality", "key_uniqueness", "table_fingerprint"].map((family) => ({
        family,
        kind: "table",
        scopes: ["whole"],
        max_calls: 1,
      })),
    });
    for (const label of ["Table quality", "Key uniqueness", "Table fingerprint"]) {
      expect(html).toContain(`>${label}</span>`);
    }
  });

  it("renders each reported family as a readable badge with the manifest's isolation and floor", () => {
    const html = render(manifest);

    expect(html).toContain("Can compute");
    for (const label of ["Row count", "Missing data bands", "Distribution bands", "Rank correlation", "Data card"]) {
      expect(html).toContain(`>${label}</span>`);
    }
    expect(html.match(/data-slot="badge"/g)).toHaveLength(5);
    expect(html).toContain("Isolation: AppContainer · min cell 5");
    expect(html).not.toContain("Not reported");
  });

  it("keeps unknown family ids, including names matching object properties", () => {
    const html = render({
      ...manifest,
      families: ["future_family", "constructor"].map((family) => ({
        family,
        kind: "profile",
        scopes: ["whole"],
        max_calls: 1,
      })),
      isolation: "none",
      floors: { min_cell: 9 },
    });

    expect(html).toContain(">future_family</span>");
    expect(html).toContain(">constructor</span>");
    expect(html).toContain("Isolation: None · min cell 9");
  });

  it.each([null, undefined])("explains unreported capabilities (%s)", (capabilities) => {
    const html = render(capabilities);

    expect(html).toContain("Not reported. Update the Local Node to see what it can compute.");
    expect(html).not.toContain('data-slot="badge"');
    expect(html).not.toContain("Isolation:");
  });

  it("distinguishes an empty reported manifest and omits an unreported floor", () => {
    const html = render({ ...manifest, families: [], floors: {} });

    expect(html).toContain("No compute families reported.");
    expect(html).toContain("Isolation: AppContainer");
    expect(html).not.toContain("Not reported");
    expect(html).not.toContain("min cell");
  });
});
