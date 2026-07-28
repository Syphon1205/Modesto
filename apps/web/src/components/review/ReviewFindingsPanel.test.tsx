// FILE: ReviewFindingsPanel.test.tsx
// Purpose: Guards the editor review panel's idle state and progress null handling.
// Layer: Component rendering tests

import {
  ProjectId,
  ReviewFindingId,
  ReviewRunId,
  ThreadId,
  type ReviewListResult,
} from "@modesto/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { reviewQueryKey } from "~/lib/reviewReactQuery";
import { ReviewFindingsPanel } from "./ReviewFindingsPanel";

describe("ReviewFindingsPanel", () => {
  it("renders the idle state when neither a run nor progress event exists", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <ReviewFindingsPanel
          threadId={ThreadId.makeUnsafe("thread-review-idle")}
          selectedAgent="Codex"
          enabled={false}
        />
      </QueryClientProvider>,
    );

    expect(markup).toContain("Ready to review");
    expect(markup).toContain("Review");
  });

  it("renders persisted review metadata, history, summaries, and findings", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const threadId = ThreadId.makeUnsafe("thread-review-history");
    const projectId = ProjectId.makeUnsafe("project-review-history");
    const configuration = {
      runtime: "codex" as const,
      model: "gpt-5.5",
      depth: "standard" as const,
      includeSecurity: true,
      includePerformance: true,
      includeArchitecture: true,
      includeTestCoverage: true,
      allowFixSuggestions: true,
      instructionFiles: ["AGENTS.md"],
    };
    const latestRunId = ReviewRunId.makeUnsafe("review-run:latest");
    const result: ReviewListResult = {
      availability: {
        provider: "modesto",
        displayName: "Modesto Review",
        installation: "detected",
        executable: "/usr/local/bin/codex",
        authenticated: "unknown",
        supportedRuntimes: ["codex", "cursor"],
        supportedTargets: ["currentFile", "uncommittedChanges"],
        message: "Available runtimes: Codex, Cursor.",
      },
      runs: [
        {
          id: latestRunId,
          threadId,
          projectId,
          provider: "modesto",
          status: "completed",
          target: { type: "currentFile", file: "src/review.ts" },
          configuration,
          findingCount: 1,
          summary: "One actionable issue was found.",
          error: null,
          startedAt: "2026-07-23T20:00:00.000Z",
          finishedAt: "2026-07-23T20:01:00.000Z",
          createdAt: "2026-07-23T20:00:00.000Z",
          updatedAt: "2026-07-23T20:01:00.000Z",
        },
        {
          id: ReviewRunId.makeUnsafe("review-run:previous"),
          threadId,
          projectId,
          provider: "modesto",
          status: "completed",
          target: { type: "uncommittedChanges" },
          configuration: { ...configuration, runtime: "cursor" },
          findingCount: 0,
          summary: "No issues were found.",
          error: null,
          startedAt: "2026-07-23T19:00:00.000Z",
          finishedAt: "2026-07-23T19:01:00.000Z",
          createdAt: "2026-07-23T19:00:00.000Z",
          updatedAt: "2026-07-23T19:01:00.000Z",
        },
      ],
      findings: [
        {
          id: ReviewFindingId.makeUnsafe("review-finding:latest"),
          runId: latestRunId,
          threadId,
          provider: "modesto",
          severity: "major",
          file: "src/review.ts",
          startLine: 42,
          endLine: 42,
          title: "Cancellation can leave stale state",
          explanation: "The active run should be cleared after cancellation.",
          suggestedFix: "Clear the active run in the finalizer.",
          status: "open",
          createdAt: "2026-07-23T20:01:00.000Z",
          updatedAt: "2026-07-23T20:01:00.000Z",
        },
      ],
    };
    queryClient.setQueryData(reviewQueryKey(threadId, "modesto"), result);

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <ReviewFindingsPanel
          threadId={threadId}
          selectedAgent="Codex"
          enabled={false}
          selectedFilePath="src/review.ts"
        />
      </QueryClientProvider>,
    );

    expect(markup).toContain("Codex · Standard");
    expect(markup).toContain("Review history");
    expect(markup).toContain("One actionable issue was found.");
    expect(markup).toContain("Cancellation can leave stale state");
    expect(markup).toContain("src/review.ts:42");
    expect(markup).toContain("Warning 1");
    expect(markup).toContain("Review progress: Review complete");
  });

  it("does not report no issues when findings are hidden by severity", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const threadId = ThreadId.makeUnsafe("thread-review-hidden");
    const runId = ReviewRunId.makeUnsafe("review-run:hidden");
    queryClient.setQueryData(reviewQueryKey(threadId, "modesto"), {
      availability: {
        provider: "modesto",
        displayName: "Modesto Review",
        installation: "detected",
        executable: "/usr/local/bin/codex",
        authenticated: "unknown",
        supportedRuntimes: ["codex"],
        supportedTargets: ["currentFile", "uncommittedChanges"],
        message: "Available runtime: Codex.",
      },
      runs: [
        {
          id: runId,
          threadId,
          projectId: ProjectId.makeUnsafe("project-review-hidden"),
          provider: "modesto",
          status: "completed",
          target: { type: "currentFile", file: "src/review.ts" },
          configuration: null,
          findingCount: 1,
          summary: "One informational issue was found.",
          error: null,
          startedAt: "2026-07-23T20:00:00.000Z",
          finishedAt: "2026-07-23T20:01:00.000Z",
          createdAt: "2026-07-23T20:00:00.000Z",
          updatedAt: "2026-07-23T20:01:00.000Z",
        },
      ],
      findings: [
        {
          id: ReviewFindingId.makeUnsafe("review-finding:hidden"),
          runId,
          threadId,
          provider: "modesto",
          severity: "info",
          file: "src/review.ts",
          startLine: 1,
          endLine: 1,
          title: "Informational note",
          explanation: "This is below the default display threshold.",
          suggestedFix: null,
          status: "open",
          createdAt: "2026-07-23T20:01:00.000Z",
          updatedAt: "2026-07-23T20:01:00.000Z",
        },
      ],
    } satisfies ReviewListResult);

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <ReviewFindingsPanel
          threadId={threadId}
          selectedAgent="Codex"
          enabled={false}
          selectedFilePath="src/review.ts"
        />
      </QueryClientProvider>,
    );

    expect(markup).toContain("Findings are hidden");
    expect(markup).not.toContain("No issues found");
  });
});
