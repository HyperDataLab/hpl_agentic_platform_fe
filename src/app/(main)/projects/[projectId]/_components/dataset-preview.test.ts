import { describe, expect, it } from "vitest";

import {
  type DatasetPreviewSource,
  inferColumnKind,
  previewColumnKey,
  previewRowKey,
  removePreviewSource,
} from "./dataset-preview";

describe("inferColumnKind", () => {
  it("recognizes numeric, text, date, and boolean samples", () => {
    expect(inferColumnKind(["12", "-3.5", "1e2"])).toBe("number");
    expect(inferColumnKind(["true", "FALSE", "yes"])).toBe("boolean");
    expect(inferColumnKind(["2026-11-14", "2026-12-01"])).toBe("date");
    expect(inferColumnKind(["Bus", "Rail"])).toBe("text");
    expect(inferColumnKind(["", "  "])).toBe("text");
  });
});

describe("removePreviewSource", () => {
  it("removes the source file and all of its sheet chips", () => {
    const source = (id: string): DatasetPreviewSource => ({
      id,
      file: new File([], `${id}.xlsx`),
      name: id,
      status: "ready",
      tables: [
        { id: `${id}:0`, fileId: id, label: "Sheet1", headers: [], rows: [], approximateRows: "~0" },
        { id: `${id}:1`, fileId: id, label: "Sheet2", headers: [], rows: [], approximateRows: "~0" },
      ],
    });

    expect(removePreviewSource([source("book"), source("survey")], "book").map((item) => item.id)).toEqual(["survey"]);
  });
});

describe("preview keys", () => {
  it("keeps duplicate column labels and rows uniquely identified across renders", () => {
    const headers = ["value", "value"];
    const rows = [
      ["x", "x"],
      ["x", "x"],
    ];
    const columns = headers.map((_, index) => previewColumnKey("sheet", headers, index));
    const keyedRows = rows.map((_, index) => previewRowKey("sheet", rows, index));

    expect(new Set(columns).size).toBe(2);
    expect(new Set(keyedRows).size).toBe(2);
    expect(headers.map((_, index) => previewColumnKey("sheet", headers, index))).toEqual(columns);
    expect(rows.map((_, index) => previewRowKey("sheet", rows, index))).toEqual(keyedRows);
  });
});
