import { Schema } from "effect";

import {
  IncomingTaskId,
  IsoDateTime,
  ProjectId,
  ThreadId,
  TrimmedNonEmptyString,
} from "./baseSchemas";
import {
  ModelSelection,
  ProviderInteractionMode,
  ProviderKind,
  RuntimeMode,
  ThreadEnvironmentMode,
} from "./orchestration";

export const IncomingTaskSource = Schema.Literals(["openclaw"]);
export type IncomingTaskSource = typeof IncomingTaskSource.Type;

export const IncomingTaskStatus = Schema.Literals([
  "accepted",
  "dispatching",
  "running",
  "completed",
  "failed",
  "rejected",
]);
export type IncomingTaskStatus = typeof IncomingTaskStatus.Type;

export const IncomingTaskPermissionSnapshot = Schema.Struct({
  projectId: ProjectId,
  modelSelection: ModelSelection,
  runtimeMode: RuntimeMode,
  interactionMode: ProviderInteractionMode,
  envMode: ThreadEnvironmentMode,
  createdAt: IsoDateTime,
});
export type IncomingTaskPermissionSnapshot = typeof IncomingTaskPermissionSnapshot.Type;

/**
 * Small source-neutral envelope for requests entering Modesto from integrations.
 * Execution remains owned by orchestration; this record only adds policy,
 * idempotency, and source history around the existing thread/turn flow.
 */
export const IncomingTask = Schema.Struct({
  id: IncomingTaskId,
  source: IncomingTaskSource,
  sourceTaskId: TrimmedNonEmptyString.check(Schema.isMaxLength(256)),
  title: TrimmedNonEmptyString.check(Schema.isMaxLength(160)),
  prompt: TrimmedNonEmptyString.check(Schema.isMaxLength(64_000)),
  projectId: ProjectId,
  requestedProvider: Schema.NullOr(ProviderKind),
  status: IncomingTaskStatus,
  threadId: Schema.NullOr(ThreadId),
  permissionSnapshot: IncomingTaskPermissionSnapshot,
  error: Schema.NullOr(Schema.String.check(Schema.isMaxLength(4_000))),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type IncomingTask = typeof IncomingTask.Type;

export const IncomingTaskSubmitInput = Schema.Struct({
  source: IncomingTaskSource,
  sourceTaskId: TrimmedNonEmptyString.check(Schema.isMaxLength(256)),
  title: Schema.optional(TrimmedNonEmptyString.check(Schema.isMaxLength(160))),
  prompt: TrimmedNonEmptyString.check(Schema.isMaxLength(64_000)),
  projectId: ProjectId,
  requestedProvider: Schema.optional(ProviderKind),
});
export type IncomingTaskSubmitInput = typeof IncomingTaskSubmitInput.Type;

export const IncomingTaskSubmitResult = Schema.Struct({
  task: IncomingTask,
  duplicate: Schema.Boolean,
});
export type IncomingTaskSubmitResult = typeof IncomingTaskSubmitResult.Type;
