/**
 * Modesto's own Claude Code plugin installer - preview/install/list/
 * uninstall a GitHub-hosted plugin (.claude-plugin/plugin.json +
 * skills/commands/agents) into the real ~/.claude directory. See
 * apps/server/src/provider/claudePluginBundle.ts and claudePluginInstall.ts
 * for the server-side implementation and v1 scope notes (skills/commands/
 * agents only - no MCP server install yet).
 */
import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@modesto/client-runtime/state/runtime";
import { WS_METHODS } from "@modesto/contracts";
import * as Effect from "effect/Effect";

import { connectionAtomRuntime } from "../connection/runtime";

export const claudePluginList = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:claude-plugins:list",
  tag: WS_METHODS.claudePluginList,
  staleTimeMs: 2_000,
  idleTtlMs: 60_000,
});

export const claudePluginPreview = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:claude-plugins:preview",
  tag: WS_METHODS.claudePluginPreview,
});

export const claudePluginInstall = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:claude-plugins:install",
  tag: WS_METHODS.claudePluginInstall,
  onSettled: (target, registry) =>
    Effect.sync(() =>
      registry.refresh(claudePluginList({ environmentId: target.environmentId, input: {} })),
    ),
});

export const claudePluginUninstall = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:claude-plugins:uninstall",
  tag: WS_METHODS.claudePluginUninstall,
  onSettled: (target, registry) =>
    Effect.sync(() =>
      registry.refresh(claudePluginList({ environmentId: target.environmentId, input: {} })),
    ),
});
