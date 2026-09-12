// FILE: desktop-stage-excluded-dependencies.ts
// Purpose: Dependency names to drop from the staged desktop app's package.json before
// `bun install --production` runs, because the desktop app downloads their CLI binary
// itself on first run instead (see apps/desktop/src/providerCliRuntimeBootstrap.ts and
// packages/shared/src/npmPlatformCliRuntime.ts). Together these are ~650MB of native
// binaries an install would otherwise carry for every provider a user may never touch.
//
// `@anthropic-ai/claude-agent-sdk` is deliberately NOT here: the base package's JS
// (the `query()` API, types) is imported directly by ClaudeAdapter.ts and friends —
// only its per-platform native binary optionalDependency is excluded, via
// CLAUDE_AGENT_SDK_NATIVE_PACKAGE_PREFIX below (bun has no per-optionalDependency
// exclusion flag, so that one has to be removed from node_modules post-install instead
// of from package.json).
export const DESKTOP_STAGE_EXCLUDED_DEPENDENCIES = ["@openai/codex", "opencode-ai"] as const;

// Matches the native platform binary optionalDependency bun resolves for
// `@anthropic-ai/claude-agent-sdk` (e.g. `@anthropic-ai/claude-agent-sdk-darwin-arm64`),
// so it can be deleted from the staged node_modules after install.
export const CLAUDE_AGENT_SDK_NATIVE_PACKAGE_PREFIX = "claude-agent-sdk-";
