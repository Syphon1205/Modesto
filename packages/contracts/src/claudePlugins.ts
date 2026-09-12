// FILE: claudePlugins.ts
// Purpose: Wire contracts for Modesto's own Claude Code plugin installer -
//          resolving a GitHub-hosted plugin repo (.claude-plugin/plugin.json
//          + skills/commands/agents) and installing its components into the
//          real ~/.claude directory the Claude Agent SDK reads from.
// Layer: Shared contracts (schema-only)
// Format reference: https://code.claude.com/docs/en/plugins-reference
//
// v1 scope: skills, commands, agents, and MCP servers. A plugin's declared
// MCP servers are installed into Claude's own user-scope `mcpServers` map in
// `.claude.json` (server side: provider/claudeMcpServers.ts), and their names
// are recorded on the installed record so uninstall removes exactly what was
// added. Servers referencing ${CLAUDE_PLUGIN_ROOT} remain unsupported and are
// reported as a preview warning: this tree has no plugin-local root to
// resolve that variable against, and guessing one would produce a server that
// silently fails to start.

import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { TrimmedNonEmptyString, TrimmedString } from "./baseSchemas.ts";

export const ClaudePluginComponentType = Schema.Literals(["mcp", "skill", "command", "agent"]);
export type ClaudePluginComponentType = typeof ClaudePluginComponentType.Type;

export const ClaudePluginComponent = Schema.Struct({
  type: ClaudePluginComponentType,
  name: TrimmedNonEmptyString,
  description: Schema.NullOr(TrimmedString),
});
export type ClaudePluginComponent = typeof ClaudePluginComponent.Type;

export const ClaudePluginSourceRef = Schema.Struct({
  owner: TrimmedNonEmptyString,
  repo: TrimmedNonEmptyString,
  ref: TrimmedNonEmptyString,
  dir: Schema.NullOr(TrimmedNonEmptyString),
});
export type ClaudePluginSourceRef = typeof ClaudePluginSourceRef.Type;

export const ClaudePluginPreview = Schema.Struct({
  pluginId: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  description: Schema.NullOr(TrimmedString),
  version: Schema.NullOr(TrimmedString),
  source: ClaudePluginSourceRef,
  components: Schema.Array(ClaudePluginComponent),
  warnings: Schema.Array(Schema.String),
});
export type ClaudePluginPreview = typeof ClaudePluginPreview.Type;

export const InstalledClaudePlugin = Schema.Struct({
  pluginId: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  description: Schema.NullOr(TrimmedString),
  namespace: TrimmedNonEmptyString,
  source: ClaudePluginSourceRef,
  fileCount: Schema.Int,
  /** User-scope MCP server names this plugin registered in Claude's config. */
  mcpServers: Schema.Array(Schema.String).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  warnings: Schema.Array(Schema.String),
  installedAt: TrimmedNonEmptyString,
});
export type InstalledClaudePlugin = typeof InstalledClaudePlugin.Type;

const CLAUDE_PLUGIN_URL_MAX_LENGTH = 512;

export const ClaudePluginPreviewInput = Schema.Struct({
  url: TrimmedNonEmptyString.check(Schema.isMaxLength(CLAUDE_PLUGIN_URL_MAX_LENGTH)),
  ref: Schema.optional(TrimmedNonEmptyString),
});
export type ClaudePluginPreviewInput = typeof ClaudePluginPreviewInput.Type;

export const ClaudePluginPreviewResult = Schema.Struct({
  preview: ClaudePluginPreview,
});
export type ClaudePluginPreviewResult = typeof ClaudePluginPreviewResult.Type;

export const ClaudePluginInstallInput = Schema.Struct({
  url: TrimmedNonEmptyString.check(Schema.isMaxLength(CLAUDE_PLUGIN_URL_MAX_LENGTH)),
  ref: Schema.optional(TrimmedNonEmptyString),
});
export type ClaudePluginInstallInput = typeof ClaudePluginInstallInput.Type;

export const ClaudePluginInstallResult = Schema.Struct({
  plugin: InstalledClaudePlugin,
});
export type ClaudePluginInstallResult = typeof ClaudePluginInstallResult.Type;

export const ClaudePluginListInput = Schema.Struct({});
export type ClaudePluginListInput = typeof ClaudePluginListInput.Type;

export const ClaudePluginListResult = Schema.Struct({
  plugins: Schema.Array(InstalledClaudePlugin),
});
export type ClaudePluginListResult = typeof ClaudePluginListResult.Type;

export const ClaudePluginUninstallInput = Schema.Struct({
  pluginId: TrimmedNonEmptyString,
});
export type ClaudePluginUninstallInput = typeof ClaudePluginUninstallInput.Type;

export const ClaudePluginUninstallResult = Schema.Struct({
  ok: Schema.Boolean,
});
export type ClaudePluginUninstallResult = typeof ClaudePluginUninstallResult.Type;

/** Stable failure codes from resolution/parsing - see claudePluginBundle.ts server-side. */
export const ClaudePluginFailureCode = Schema.Literals([
  "invalid_plugin_url",
  "plugin_fetch_failed",
  "plugin_ref_not_found",
  "plugin_manifest_not_found",
  "plugin_ambiguous",
  "invalid_plugin_manifest",
  "plugin_empty",
  "install_failed",
]);
export type ClaudePluginFailureCode = typeof ClaudePluginFailureCode.Type;

export class ClaudePluginRequestError extends Schema.TaggedErrorClass<ClaudePluginRequestError>()(
  "ClaudePluginRequestError",
  {
    code: ClaudePluginFailureCode,
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect()),
  },
) {}
