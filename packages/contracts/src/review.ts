import { Schema } from "effect";

import {
  ProjectId,
  ReviewFindingId,
  ReviewRunId,
  ThreadId,
  TrimmedNonEmptyString,
} from "./baseSchemas";

export const ReviewProvider = Schema.Literals(["modesto", "coderabbit", "greptile"]);
export type ReviewProvider = typeof ReviewProvider.Type;

export const ReviewRuntime = Schema.Literals(["codex", "cursor"]);
export type ReviewRuntime = typeof ReviewRuntime.Type;

export const ReviewDepth = Schema.Literals(["quick", "standard", "deep"]);
export type ReviewDepth = typeof ReviewDepth.Type;

export const ReviewConfiguration = Schema.Struct({
  runtime: ReviewRuntime,
  model: Schema.String.check(Schema.isMaxLength(256)),
  depth: ReviewDepth,
  includeSecurity: Schema.Boolean,
  includePerformance: Schema.Boolean,
  includeArchitecture: Schema.Boolean,
  includeTestCoverage: Schema.Boolean,
  allowFixSuggestions: Schema.Boolean,
  instructionFiles: Schema.Array(TrimmedNonEmptyString.check(Schema.isMaxLength(4_096))).check(
    Schema.isMaxLength(32),
  ),
});
export type ReviewConfiguration = typeof ReviewConfiguration.Type;

export const ReviewTargetKind = Schema.Literals([
  "currentFile",
  "selectedCode",
  "uncommittedChanges",
  "stagedChanges",
  "selectedFiles",
  "repository",
  "pullRequest",
]);
export type ReviewTargetKind = typeof ReviewTargetKind.Type;

export const ReviewTarget = Schema.Union([
  Schema.Struct({ type: Schema.Literal("currentFile"), file: TrimmedNonEmptyString }),
  Schema.Struct({
    type: Schema.Literal("selectedCode"),
    file: TrimmedNonEmptyString,
    startLine: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
    endLine: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  }),
  Schema.Struct({ type: Schema.Literal("uncommittedChanges") }),
  Schema.Struct({ type: Schema.Literal("stagedChanges") }),
  Schema.Struct({
    type: Schema.Literal("selectedFiles"),
    files: Schema.Array(TrimmedNonEmptyString),
  }),
  Schema.Struct({ type: Schema.Literal("repository") }),
  Schema.Struct({
    type: Schema.Literal("pullRequest"),
    number: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
    baseBranch: TrimmedNonEmptyString,
  }),
]);
export type ReviewTarget = typeof ReviewTarget.Type;

export const ReviewSeverity = Schema.Literals(["critical", "major", "minor", "trivial", "info"]);
export type ReviewSeverity = typeof ReviewSeverity.Type;

export const ReviewFindingStatus = Schema.Literals(["open", "ignored"]);
export type ReviewFindingStatus = typeof ReviewFindingStatus.Type;

export const ReviewRunStatus = Schema.Literals([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "skipped",
]);
export type ReviewRunStatus = typeof ReviewRunStatus.Type;

export const ReviewFinding = Schema.Struct({
  id: ReviewFindingId,
  runId: ReviewRunId,
  threadId: ThreadId,
  provider: ReviewProvider,
  severity: ReviewSeverity,
  file: TrimmedNonEmptyString.check(Schema.isMaxLength(4_096)),
  startLine: Schema.NullOr(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))),
  endLine: Schema.NullOr(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))),
  title: TrimmedNonEmptyString.check(Schema.isMaxLength(500)),
  explanation: Schema.String.check(Schema.isMaxLength(16_000)),
  suggestedFix: Schema.NullOr(Schema.String.check(Schema.isMaxLength(16_000))),
  status: ReviewFindingStatus,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type ReviewFinding = typeof ReviewFinding.Type;

export const ReviewRun = Schema.Struct({
  id: ReviewRunId,
  threadId: ThreadId,
  projectId: ProjectId,
  provider: ReviewProvider,
  status: ReviewRunStatus,
  target: Schema.NullOr(ReviewTarget),
  configuration: Schema.NullOr(ReviewConfiguration),
  findingCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  summary: Schema.NullOr(Schema.String.check(Schema.isMaxLength(4_000))),
  error: Schema.NullOr(Schema.String.check(Schema.isMaxLength(4_000))),
  startedAt: Schema.NullOr(Schema.String),
  finishedAt: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type ReviewRun = typeof ReviewRun.Type;

export const ReviewAvailability = Schema.Struct({
  provider: ReviewProvider,
  displayName: TrimmedNonEmptyString,
  installation: Schema.Literals(["detected", "not-found"]),
  executable: Schema.NullOr(Schema.String),
  authenticated: Schema.Literals(["yes", "no", "unknown"]),
  supportedRuntimes: Schema.Array(ReviewRuntime),
  supportedTargets: Schema.Array(ReviewTargetKind),
  message: Schema.NullOr(Schema.String),
});
export type ReviewAvailability = typeof ReviewAvailability.Type;

export const ReviewProviderListResult = Schema.Struct({
  providers: Schema.Array(ReviewAvailability),
});
export type ReviewProviderListResult = typeof ReviewProviderListResult.Type;

export const ReviewInstallInput = Schema.Struct({
  provider: Schema.Literal("coderabbit"),
  action: Schema.Literals(["install", "authenticate"]),
});
export type ReviewInstallInput = typeof ReviewInstallInput.Type;

export const ReviewInstallResult = Schema.Struct({
  availability: ReviewAvailability,
});
export type ReviewInstallResult = typeof ReviewInstallResult.Type;

export const ReviewListInput = Schema.Struct({ threadId: ThreadId, provider: ReviewProvider });
export type ReviewListInput = typeof ReviewListInput.Type;

export const ReviewListResult = Schema.Struct({
  availability: ReviewAvailability,
  runs: Schema.Array(ReviewRun),
  findings: Schema.Array(ReviewFinding),
});
export type ReviewListResult = typeof ReviewListResult.Type;

export const ReviewStartInput = Schema.Struct({
  threadId: ThreadId,
  provider: ReviewProvider,
  target: ReviewTarget,
  configuration: Schema.optional(ReviewConfiguration),
});
export type ReviewStartInput = typeof ReviewStartInput.Type;

export const ReviewCancelInput = Schema.Struct({
  runId: ReviewRunId,
});
export type ReviewCancelInput = typeof ReviewCancelInput.Type;

export const ReviewIgnoreFindingInput = Schema.Struct({
  findingId: ReviewFindingId,
  ignored: Schema.Boolean,
});
export type ReviewIgnoreFindingInput = typeof ReviewIgnoreFindingInput.Type;

export const ReviewStreamEvent = Schema.Union([
  Schema.Struct({ type: Schema.Literal("run"), run: ReviewRun }),
  Schema.Struct({ type: Schema.Literal("finding"), finding: ReviewFinding }),
  Schema.Struct({
    type: Schema.Literal("progress"),
    runId: ReviewRunId,
    threadId: ThreadId,
    stage: Schema.Literals([
      "preparing_context",
      "analyzing_changes",
      "checking_issues",
      "review_complete",
    ]),
    message: TrimmedNonEmptyString,
  }),
]);
export type ReviewStreamEvent = typeof ReviewStreamEvent.Type;
