import { Schema } from "effect";

import { TrimmedNonEmptyString } from "./baseSchemas";

const BoundedString = TrimmedNonEmptyString.check(Schema.isMaxLength(2_048));

export const LangGraphAssistant = Schema.Struct({
  assistantId: TrimmedNonEmptyString,
  graphId: TrimmedNonEmptyString,
  name: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
});
export type LangGraphAssistant = typeof LangGraphAssistant.Type;

export const LangGraphConnectionConfig = Schema.Struct({
  deploymentUrl: Schema.NullOr(BoundedString),
  assistantId: Schema.NullOr(TrimmedNonEmptyString),
  enabled: Schema.Boolean,
  hasApiKey: Schema.Boolean,
  updatedAt: Schema.String,
});
export type LangGraphConnectionConfig = typeof LangGraphConnectionConfig.Type;

export const LangGraphConnectionConfigUpdate = Schema.Struct({
  deploymentUrl: Schema.optional(Schema.NullOr(BoundedString)),
  assistantId: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  apiKey: Schema.optional(
    Schema.NullOr(TrimmedNonEmptyString.check(Schema.isMaxLength(8_192))),
  ),
  enabled: Schema.optional(Schema.Boolean),
});
export type LangGraphConnectionConfigUpdate = typeof LangGraphConnectionConfigUpdate.Type;

export const LangGraphConnectionStatus = Schema.Struct({
  state: Schema.Literals(["connected", "disconnected", "error"]),
  message: Schema.NullOr(Schema.String),
  checkedAt: Schema.NullOr(Schema.String),
  assistants: Schema.Array(LangGraphAssistant),
});
export type LangGraphConnectionStatus = typeof LangGraphConnectionStatus.Type;

export const LangGraphSnapshot = Schema.Struct({
  config: LangGraphConnectionConfig,
  status: LangGraphConnectionStatus,
});
export type LangGraphSnapshot = typeof LangGraphSnapshot.Type;

export const LangGraphGetSnapshotInput = Schema.Struct({});
export const LangGraphTestConnectionInput = Schema.Struct({});

export const LangGraphInvokeInput = Schema.Struct({
  assistantId: Schema.optional(TrimmedNonEmptyString),
  input: Schema.Unknown,
});
export type LangGraphInvokeInput = typeof LangGraphInvokeInput.Type;

export const LangGraphInvokeResult = Schema.Struct({
  assistantId: TrimmedNonEmptyString,
  output: Schema.Unknown,
  completedAt: Schema.String,
});
export type LangGraphInvokeResult = typeof LangGraphInvokeResult.Type;
