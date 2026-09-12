import type { OrchestrationCheckpointSummary } from "@modesto/contracts";
import { describe, expect, it } from "vitest";

import { EMPTY_TASK_CHANGE_SUMMARY, summarizeTaskChanges } from "./taskChangeSummary";

const checkpoint = (
  files: ReadonlyArray<{ path: string; additions: number; deletions: number }>,
  status: "ready" | "missing" | "error" = "ready",
): OrchestrationCheckpointSummary =>
  ({
    turnId: "turn",
    checkpointTurnCount: 1,
    checkpointRef: "ref",
    status,
    files: files.map((file) => ({ ...file, kind: "modified" })),
    assistantMessageId: null,
    completedAt: "2026-03-01T00:00:00.000Z",
  }) as never;

describe("summarizeTaskChanges", () => {
  it("folds the same file across turns into one row", () => {
    // The point of the whole module: five turns touching one file is one
    // changed file, not five.
    const summary = summarizeTaskChanges([
      checkpoint([{ path: "a.ts", additions: 3, deletions: 1 }]),
      checkpoint([{ path: "a.ts", additions: 2, deletions: 4 }]),
    ]);

    expect(summary.files).toEqual([{ path: "a.ts", additions: 5, deletions: 5, turnCount: 2 }]);
    expect(summary.additions).toBe(5);
    expect(summary.deletions).toBe(5);
    expect(summary.turnCount).toBe(2);
  });

  it("orders files by total churn, biggest first", () => {
    const summary = summarizeTaskChanges([
      checkpoint([
        { path: "small.ts", additions: 1, deletions: 0 },
        { path: "big.ts", additions: 40, deletions: 10 },
      ]),
    ]);

    expect(summary.files.map((file) => file.path)).toEqual(["big.ts", "small.ts"]);
  });

  it("breaks churn ties on path so order is stable", () => {
    const summary = summarizeTaskChanges([
      checkpoint([
        { path: "b.ts", additions: 2, deletions: 0 },
        { path: "a.ts", additions: 2, deletions: 0 },
      ]),
    ]);

    expect(summary.files.map((file) => file.path)).toEqual(["a.ts", "b.ts"]);
  });

  it("ignores checkpoints whose file list cannot be trusted", () => {
    // Reporting changes that may not exist is worse than reporting none.
    const summary = summarizeTaskChanges([
      checkpoint([{ path: "a.ts", additions: 9, deletions: 9 }], "missing"),
      checkpoint([{ path: "b.ts", additions: 9, deletions: 9 }], "error"),
    ]);

    expect(summary).toEqual(EMPTY_TASK_CHANGE_SUMMARY);
  });

  it("does not count a ready checkpoint that touched nothing", () => {
    expect(summarizeTaskChanges([checkpoint([])]).turnCount).toBe(0);
  });

  it("returns an empty summary for a task with no checkpoints", () => {
    expect(summarizeTaskChanges([])).toEqual(EMPTY_TASK_CHANGE_SUMMARY);
  });
});
