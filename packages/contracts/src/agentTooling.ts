import { Schema } from "effect";

const SafeName = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200));
const SafePath = Schema.String.check(Schema.isMaxLength(4096));
const SafeCommand = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(8192));

export const McpServerSummary = Schema.Struct({
  name: SafeName,
  command: Schema.String,
  args: Schema.Array(Schema.String),
  cwd: Schema.optional(SafePath),
  enabled: Schema.Boolean,
  startupTimeoutSec: Schema.optional(Schema.Number),
  hasEnv: Schema.Boolean,
});
export type McpServerSummary = typeof McpServerSummary.Type;
export const McpServersResult = Schema.Struct({
  servers: Schema.Array(McpServerSummary),
  configPath: SafePath,
});
export type McpServersResult = typeof McpServersResult.Type;
export const McpServerEnabledInput = Schema.Struct({ name: SafeName, enabled: Schema.Boolean });
export type McpServerEnabledInput = typeof McpServerEnabledInput.Type;
export const McpServerUpsertInput = Schema.Struct({
  name: SafeName,
  command: SafeCommand,
  args: Schema.Array(Schema.String),
  cwd: Schema.optional(SafePath),
  enabled: Schema.Boolean,
});
export type McpServerUpsertInput = typeof McpServerUpsertInput.Type;
export const McpServerRemoveInput = Schema.Struct({ name: SafeName });
export type McpServerRemoveInput = typeof McpServerRemoveInput.Type;

export const HookCommand = Schema.Struct({ type: Schema.Literal("command"), command: SafeCommand });
export const HookEvent = Schema.Struct({ eventName: SafeName, hooks: Schema.Array(HookCommand) });
export const HooksResult = Schema.Struct({
  configPath: SafePath,
  exists: Schema.Boolean,
  events: Schema.Array(HookEvent),
});
export type HooksResult = typeof HooksResult.Type;
export const HookSetInput = Schema.Struct({
  eventName: Schema.Literals(["UserPromptSubmit", "Stop"]),
  command: Schema.optional(SafeCommand),
  enabled: Schema.Boolean,
});
export type HookSetInput = typeof HookSetInput.Type;

export const AgentRuleMetadata = Schema.Struct({
  path: SafePath,
  size: Schema.Number,
  mtime: Schema.String,
  lineCount: Schema.Number,
});
export const AgentRulesResult = Schema.Struct({ rules: Schema.Array(AgentRuleMetadata) });
export type AgentRulesResult = typeof AgentRulesResult.Type;
