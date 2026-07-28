import { ProjectId, ReviewRunId, ThreadId, type ReviewRun } from "@modesto/contracts";
import { describe, expect, it } from "vitest";

import {
  buildReviewTarget,
  describeReviewConfiguration,
  describeReviewTarget,
  reviewRunOptionLabel,
  reviewStatusLabel,
} from "./reviewPresentation";

describe("reviewPresentation", () => {
  it("builds editor selection targets without inventing a file or range", () => {
    expect(
      buildReviewTarget(
        "selectedCode",
        "src/app.ts",
        { path: "src/app.ts", startLine: 14, endLine: 19 },
        [],
        null,
      ),
    ).toEqual({
      target: {
        type: "selectedCode",
        file: "src/app.ts",
        startLine: 14,
        endLine: 19,
      },
      reason: null,
    });
    expect(buildReviewTarget("currentFile", null, null, [], null)).toEqual({
      target: null,
      reason: "Open a file first.",
    });
  });

  it("describes persisted runtime and target metadata", () => {
    const configuration = {
      runtime: "cursor" as const,
      model: "auto",
      depth: "deep" as const,
      includeSecurity: true,
      includePerformance: true,
      includeArchitecture: true,
      includeTestCoverage: true,
      allowFixSuggestions: true,
      instructionFiles: ["AGENTS.md"],
    };
    expect(describeReviewConfiguration(configuration)).toBe("Cursor · Deep");
    expect(
      describeReviewTarget({
        type: "selectedCode",
        file: "src/app.ts",
        startLine: 14,
        endLine: 19,
      }),
    ).toBe("src/app.ts:14-19");
  });

  it("labels history entries and real progress states", () => {
    const run: ReviewRun = {
      id: ReviewRunId.makeUnsafe("review-run:test"),
      threadId: ThreadId.makeUnsafe("thread:test"),
      projectId: ProjectId.makeUnsafe("project:test"),
      provider: "modesto",
      status: "completed",
      target: { type: "uncommittedChanges" },
      configuration: null,
      findingCount: 0,
      summary: "No issues.",
      error: null,
      startedAt: "2026-07-23T20:00:00.000Z",
      finishedAt: "2026-07-23T20:01:00.000Z",
      createdAt: "2026-07-23T20:00:00.000Z",
      updatedAt: "2026-07-23T20:01:00.000Z",
    };

    expect(reviewRunOptionLabel(run)).toContain("Uncommitted changes");
    expect(reviewStatusLabel("running", "Checking changed code")).toBe("Checking changed code");
    expect(reviewStatusLabel("completed", null)).toBe("Review complete");
  });
});
