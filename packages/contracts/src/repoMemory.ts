import { Schema } from "effect";
import { NonNegativeInt, TrimmedNonEmptyString } from "./baseSchemas";

export const RepoMemoryFileKind = Schema.Literals([
  "agents",
  "claude",
  "readme",
  "architecture",
  "decision-record",
  "other",
]);
export type RepoMemoryFileKind = typeof RepoMemoryFileKind.Type;

export const RepoMemoryFile = Schema.Struct({
  path: TrimmedNonEmptyString,
  kind: RepoMemoryFileKind,
  contentHash: Schema.NullOr(TrimmedNonEmptyString),
  mtimeMs: Schema.NullOr(Schema.Number),
  exists: Schema.Boolean,
});
export type RepoMemoryFile = typeof RepoMemoryFile.Type;

export const RepoMemoryListInput = Schema.Struct({
  workspaceRoot: TrimmedNonEmptyString,
});
export type RepoMemoryListInput = typeof RepoMemoryListInput.Type;

export const RepoMemoryListResult = Schema.Struct({
  files: Schema.Array(RepoMemoryFile),
});
export type RepoMemoryListResult = typeof RepoMemoryListResult.Type;

export const RepoMemoryWritebackConfidence = Schema.Literals(["low", "medium", "high"]);
export type RepoMemoryWritebackConfidence = typeof RepoMemoryWritebackConfidence.Type;

export const RepoMemoryWritebackSuggestion = Schema.Struct({
  targetPath: TrimmedNonEmptyString,
  reason: TrimmedNonEmptyString,
  excerpt: TrimmedNonEmptyString,
  confidence: RepoMemoryWritebackConfidence,
});
export type RepoMemoryWritebackSuggestion = typeof RepoMemoryWritebackSuggestion.Type;

export const RepoMemorySuggestInput = Schema.Struct({
  workspaceRoot: TrimmedNonEmptyString,
  conversationNotes: Schema.String,
});
export type RepoMemorySuggestInput = typeof RepoMemorySuggestInput.Type;

export const RepoMemorySuggestResult = Schema.Struct({
  suggestions: Schema.Array(RepoMemoryWritebackSuggestion),
});
export type RepoMemorySuggestResult = typeof RepoMemorySuggestResult.Type;

export const RepoMemoryWriteMode = Schema.Literals(["append", "create-only"]);
export type RepoMemoryWriteMode = typeof RepoMemoryWriteMode.Type;

export const RepoMemoryApplyWriteInput = Schema.Struct({
  workspaceRoot: TrimmedNonEmptyString,
  path: TrimmedNonEmptyString,
  content: Schema.String,
  mode: RepoMemoryWriteMode,
});
export type RepoMemoryApplyWriteInput = typeof RepoMemoryApplyWriteInput.Type;

export const RepoMemoryApplyWriteResult = Schema.Struct({
  path: TrimmedNonEmptyString,
  created: Schema.Boolean,
  appended: Schema.Boolean,
  bytesWritten: NonNegativeInt,
});
export type RepoMemoryApplyWriteResult = typeof RepoMemoryApplyWriteResult.Type;
