// FILE: claudeMcpConfig.ts
// Purpose: Pure edits to the `mcpServers` map inside Claude Code's own
//          config file (`~/.claude.json`, or the CLAUDE_CONFIG_DIR
//          equivalent). No filesystem access - the caller owns the file.
// Layer: Shared pure utility
//
// Mirrors `codexMcpConfig.ts`, which does the same job for Codex's TOML. The
// difference that matters: this file is Claude Code's live config, holding far
// more than MCP servers (project history, caches, onboarding flags). Every
// function here therefore treats the document as opaque except for the one key
// it owns - unknown keys round-trip untouched, because dropping one would
// corrupt the user's CLI, not just their plugin.
//
// User scope is deliberate. `mcpServers` at the top level is what
// `claude mcp add -s user` writes and applies across every project; the
// per-project maps under `projects[<cwd>].mcpServers` are scoped to one
// directory, which is the wrong lifetime for something installed from a
// plugin.

export type ClaudeMcpServerConfig = Readonly<Record<string, unknown>>;

export interface ClaudeMcpServerEntry {
  readonly name: string;
  readonly config: ClaudeMcpServerConfig;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Read the user-scope servers. A missing or malformed map reads as empty. */
export function listClaudeMcpServers(document: unknown): ReadonlyArray<ClaudeMcpServerEntry> {
  if (!isRecord(document) || !isRecord(document.mcpServers)) return [];
  return Object.entries(document.mcpServers)
    .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
    .map(([name, config]) => ({ name, config }))
    .toSorted((left, right) => left.name.localeCompare(right.name));
}

export function hasClaudeMcpServer(document: unknown, name: string): boolean {
  return listClaudeMcpServers(document).some((entry) => entry.name === name);
}

/**
 * Add or replace one server, returning a new document.
 *
 * A name that already exists is overwritten: re-installing a plugin should
 * converge on what the plugin declares rather than accumulate stale variants.
 * The caller is responsible for warning about a collision it did not expect.
 */
export function upsertClaudeMcpServer(
  document: unknown,
  entry: ClaudeMcpServerEntry,
): Record<string, unknown> {
  const base = isRecord(document) ? document : {};
  const servers = isRecord(base.mcpServers) ? base.mcpServers : {};
  return {
    ...base,
    mcpServers: { ...servers, [entry.name]: entry.config },
  };
}

/** Remove one server by name. Removing something absent is a no-op. */
export function removeClaudeMcpServer(document: unknown, name: string): Record<string, unknown> {
  const base = isRecord(document) ? document : {};
  if (!isRecord(base.mcpServers) || !(name in base.mcpServers)) {
    return { ...base };
  }
  const { [name]: _removed, ...rest } = base.mcpServers;
  return { ...base, mcpServers: rest };
}
