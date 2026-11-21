import { describe, expect, it, vi } from "vitest";

import { RunStatus } from "@/types/enums";

import { runLabel, toCreateRunRequest, toRunItem, toWorkerGateAnswer } from "./fetch-runs";

const llm = { base_url: "https://r.example/v1", api_key: "sk", model: "m" };

describe("worker run contract", () => {
  it("builds the start body from the run studio's input, keeping only the sources picked", () => {
    expect(
      toCreateRunRequest(
        { problem: "  Does BM25 help?  ", intent: { kind: "test", text: "" }, domains: ["IR"] },
        "copilot",
        llm,
        { corpus_id: "c1", lab_kg: true, sciatlas: false, fulltext: undefined },
        2,
      ),
    ).toEqual({
      topic: "Does BM25 help?",
      domains: ["IR"],
      review_mode: "copilot",
      budget_usd: 2,
      llm,
      sources: { corpus_id: "c1", lab_kg: true },
    });
    expect(toCreateRunRequest({ problem: "x", intent: { kind: "test", text: "" }, domains: [] }, "auto", llm)).toEqual({
      topic: "x",
      review_mode: "auto",
      llm,
    });
  });

  it("sends the case, trimmed and without its empty parts", () => {
    const body = toCreateRunRequest(
      {
        problem: "Does spaced practice beat massed practice?",
        intent: { kind: "compare", text: "  Compare spaced and massed practice  " },
        context: "  Second-year students ",
        constraints: ["Only public data", "  "],
        references: [{ citation: " Cepeda 2006 " }],
        domains: [],
      },
      "copilot",
      llm,
    );
    expect(body.case).toEqual({
      intent: { kind: "compare", text: "Compare spaced and massed practice" },
      context: "Second-year students",
      constraints: ["Only public data"],
      references: [{ citation: "Cepeda 2006" }],
    });
    const minimal = toCreateRunRequest(
      {
        problem: "Does spaced practice beat massed practice?",
        intent: { kind: "test", text: "Test whether spacing helps" },
        context: " ",
        constraints: [],
        references: [],
        domains: [],
      },
      "auto",
      llm,
    );
    expect(minimal.case).toEqual({ intent: { kind: "test", text: "Test whether spacing helps" } });
  });

  it.each([
    [{ option_id: "approve" }, { option_id: "approve" }],
    [
      { option_id: "approve", dropped: ["h2"], note: " fine " },
      { option_id: "drop", dropped: ["h2"], note: "fine" },
    ],
    [{ option_id: "accept", dropped: [] }, { option_id: "approve" }],
    [{ option_id: "reject", dropped: ["h1"] }, { option_id: "reject" }],
    [
      { option_id: "stop", note: "off topic" },
      { option_id: "reject", note: "off topic" },
    ],
  ])("answers a gate %j as %j", (answer, expected) => {
    expect(toWorkerGateAnswer(answer)).toEqual(expected);
  });

  it("shows a run from the worker's run list as a run whose events the studio reads directly", () => {
    const record = {
      run_id: "r",
      project_id: "p",
      topic: "Does BM25 help?",
      review_mode: "light" as const,
      domains: ["IR"],
      status: "running",
      message: null,
      last_seq: 3,
      cost_usd: null,
      created_by: "a@hyperdatalab.org",
      created_at: "2026-11-19T00:00:00.000Z",
      updated_at: "2026-11-19T00:01:00.000Z",
    };
    const listed = toRunItem("p", record);
    expect(listed).toMatchObject({
      id: "r",
      project_id: "p",
      status: RunStatus.Running,
      pipeline_key: null,
      label: "RUN-R",
      title: "Does BM25 help?",
      case: { problem: { text: "Does BM25 help?" } },
      finished_at: null,
    });
    const failed = toRunItem("p", {
      ...record,
      status: "failed",
      last_seq: 40,
      cost_usd: "0.25",
      message: "LLM refused",
    });
    expect(failed).toMatchObject({
      status: RunStatus.Failed,
      failure_message: "LLM refused",
      last_seq: 40,
      cost_usd: "0.25",
      finished_at: record.updated_at,
    });
  });
});

describe("run labels", () => {
  it("drops the worker's run- prefix", () => {
    expect(runLabel("run-65660351-8022-41ef-8895-121054d53473")).toBe("RUN-6566");
    expect(runLabel("78d5a948")).toBe("RUN-78D5");
  });
});

describe("gate answers after an engine restart", () => {
  it("sends the answer again with the language model when the worker asks for the key", async () => {
    const { default: apiService } = await import("../core");
    const { ApiError } = await import("@/types/api");
    const { fetchRuns } = await import("./fetch-runs");
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => (key === "i2h.llm.key" ? "sk-test" : null),
        setItem: () => undefined,
        removeItem: () => undefined,
      },
    });
    const post = vi
      .spyOn(apiService, "post")
      .mockRejectedValueOnce(new ApiError(503, "LLM_KEY_REQUIRED", "Send the key again"))
      .mockResolvedValueOnce({ data: { gate_id: "g1", resolved_seq: 9 } } as never);
    const result = await fetchRuns.answerGate("p", "r", "g1", { option_id: "approve" });
    expect(result.data).toEqual({ gate_id: "g1", resolved_seq: 9 });
    expect(post.mock.calls[0][1]).toEqual({ option_id: "approve" });
    expect(post.mock.calls[1][1]).toMatchObject({ option_id: "approve", llm: { api_key: "sk-test" } });
  });

  it("does not send the key when the gate is answered", async () => {
    const { default: apiService } = await import("../core");
    const { fetchRuns } = await import("./fetch-runs");
    const post = vi.spyOn(apiService, "post").mockResolvedValueOnce({ data: {} } as never);
    await fetchRuns.answerGate("p", "r", "g1", { option_id: "reject" });
    expect(post).toHaveBeenCalledOnce();
    expect(post.mock.calls[0][1]).toEqual({ option_id: "reject" });
  });
});
