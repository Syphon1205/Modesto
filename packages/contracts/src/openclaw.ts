import { Schema } from "effect";

import { ProjectId, TrimmedNonEmptyString } from "./baseSchemas";
import { IncomingTask, IncomingTaskSubmitResult } from "./incomingTask";
import {
  ModelSelection,
  ProviderKind,
  ProviderInteractionMode,
  RuntimeMode,
  ThreadEnvironmentMode,
} from "./orchestration";

export const OpenClawConnectionConfig = Schema.Struct({
  gatewayUrl: Schema.NullOr(TrimmedNonEmptyString.check(Schema.isMaxLength(2_048))),
  allowedProjectIds: Schema.Array(ProjectId),
  allowedModelSelections: Schema.Array(ModelSelection),
  defaultModelSelection: Schema.NullOr(ModelSelection),
  runtimeMode: RuntimeMode,
  interactionMode: ProviderInteractionMode,
  envMode: ThreadEnvironmentMode,
  enabled: Schema.Boolean,
  updatedAt: Schema.String,
});
export type OpenClawConnectionConfig = typeof OpenClawConnectionConfig.Type;

export const OpenClawConnectionConfigUpdate = Schema.Struct({
  gatewayUrl: Schema.optional(
    Schema.NullOr(TrimmedNonEmptyString.check(Schema.isMaxLength(2_048))),
  ),
  gatewayToken: Schema.optional(
    Schema.NullOr(TrimmedNonEmptyString.check(Schema.isMaxLength(8_192))),
  ),
  allowedProjectIds: Schema.optional(Schema.Array(ProjectId)),
  allowedModelSelections: Schema.optional(Schema.Array(ModelSelection)),
  defaultModelSelection: Schema.optional(Schema.NullOr(ModelSelection)),
  runtimeMode: Schema.optional(RuntimeMode),
  interactionMode: Schema.optional(ProviderInteractionMode),
  envMode: Schema.optional(ThreadEnvironmentMode),
  enabled: Schema.optional(Schema.Boolean),
});
export type OpenClawConnectionConfigUpdate = typeof OpenClawConnectionConfigUpdate.Type;

export const OpenClawGatewayStatus = Schema.Struct({
  installation: Schema.Literals(["detected", "not-found"]),
  executable: Schema.NullOr(Schema.String),
  gateway: Schema.Literals(["connected", "disconnected", "unknown"]),
  gatewayUrl: Schema.NullOr(Schema.String),
  plugin: Schema.Literals(["installed", "not-installed", "unknown"]),
  version: Schema.NullOr(Schema.String),
  message: Schema.NullOr(Schema.String),
});
export type OpenClawGatewayStatus = typeof OpenClawGatewayStatus.Type;

export const OpenClawSnapshot = Schema.Struct({
  config: OpenClawConnectionConfig,
  status: OpenClawGatewayStatus,
  tasks: Schema.Array(IncomingTask),
});
export type OpenClawSnapshot = typeof OpenClawSnapshot.Type;

export const OpenClawGetSnapshotInput = Schema.Struct({});
export type OpenClawGetSnapshotInput = typeof OpenClawGetSnapshotInput.Type;

export const OpenClawTestConnectionInput = Schema.Struct({});
export type OpenClawTestConnectionInput = typeof OpenClawTestConnectionInput.Type;

export const OpenClawSetupInput = Schema.Struct({
  installPlugin: Schema.optional(Schema.Boolean).pipe(Schema.withDecodingDefault(() => true)),
});
export type OpenClawSetupInput = typeof OpenClawSetupInput.Type;

export const OpenClawSubmitTaskInput = Schema.Struct({
  sourceTaskId: TrimmedNonEmptyString.check(Schema.isMaxLength(256)),
  title: Schema.optional(TrimmedNonEmptyString.check(Schema.isMaxLength(160))),
  prompt: TrimmedNonEmptyString.check(Schema.isMaxLength(64_000)),
  projectId: ProjectId,
  requestedProvider: Schema.optional(ProviderKind),
});
export type OpenClawSubmitTaskInput = typeof OpenClawSubmitTaskInput.Type;

export const OpenClawSubmitTaskResult = IncomingTaskSubmitResult;
export type OpenClawSubmitTaskResult = typeof OpenClawSubmitTaskResult.Type;

export const OpenClawStreamEvent = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("status"),
    status: OpenClawGatewayStatus,
  }),
  Schema.Struct({
    type: Schema.Literal("task"),
    task: IncomingTask,
  }),
]);
export type OpenClawStreamEvent = typeof OpenClawStreamEvent.Type;
