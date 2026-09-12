// FILE: claudeMcpServers.ts
// Purpose: Installs and removes MCP servers in Claude Code's own config file -
//          the mechanism behind a plugin's declared MCP servers actually
//          working after install.
// Layer: Server provider helper
//
// Claude Code reads user-scope MCP servers from the top-level `mcpServers` map
// in `.claude.json`, which sits next to the `.claude` directory in the user's
// home. That file is Claude's live config and holds far more than MCP servers,
// so the JSON manipulation lives in `@modesto/shared/claudeMcpConfig`, which is
// pure, separately tested, and preserves every key it does not own.
//
// This module owns only the file: where it is, and writing it safely. The
// write goes through a temp file in the same directory and a rename, for the
// same reason the Codex equivalent does: a partial write here would not just
// lose a plugin's server, it could leave the user's Claude CLI unable to
// start.

import {
  listClaudeMcpServers,
  removeClaudeMcpServer,
  upsertClaudeMcpServer,
  type ClaudeMcpServerEntry,
} from "@modesto/shared/claudeMcpConfig";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

/**
 * Claude's config file for a given `.claude` directory.
 *
 * `~/.claude` -> `~/.claude.json`. Deriving it from the directory rather than
 * hardcoding the home keeps the test override (`claudeDirOverride`) honest:
 * a test pointing at a temp dir gets that dir's config file, not the real one.
 */
export function claudeConfigPathFor(path: Path.Path, claudeDir: string): string {
  return path.join(path.dirname(claudeDir), ".claude.json");
}

const readDocument = Effect.fn("claudeMcpServers.readDocument")(function* (configPath: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const exists = yield* fileSystem.exists(configPath).pipe(Effect.orElseSucceed(() => false));
  if (!exists) return {};
  const text = yield* fileSystem.readFileString(configPath).pipe(Effect.orElseSucceed(() => ""));
  if (text.trim().length === 0) return {};
  return yield* Effect.try({
    try: () => JSON.parse(text) as unknown,
    // A config we cannot parse is not ours to rewrite: overwriting it would
    // destroy whatever Claude had there. Callers treat this as a failure.
    catch: () => new ClaudeMcpConfigUnreadableError(configPath),
  });
});

export class ClaudeMcpConfigUnreadableError extends Error {
  readonly configPath: string;

  constructor(configPath: string) {
    super(
      `Claude's config at ${configPath} is not valid JSON, so its MCP servers were left untouched.`,
    );
    this.name = "ClaudeMcpConfigUnreadableError";
    this.configPath = configPath;
  }
}

const writeDocument = Effect.fn("claudeMcpServers.writeDocument")(function* (
  configPath: string,
  document: unknown,
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fileSystem.makeDirectory(path.dirname(configPath), { recursive: true });
  const tempPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
  yield* fileSystem.writeFileString(tempPath, `${JSON.stringify(document, null, 2)}\n`);
  yield* fileSystem.rename(tempPath, configPath);
});

/** Add or replace each server, leaving the rest of Claude's config alone. */
export const installClaudeMcpServers = Effect.fn("installClaudeMcpServers")(function* (input: {
  readonly claudeDir: string;
  readonly servers: ReadonlyArray<ClaudeMcpServerEntry>;
}): Effect.fn.Return<ReadonlyArray<string>, Error, FileSystem.FileSystem | Path.Path> {
  if (input.servers.length === 0) return [];
  const path = yield* Path.Path;
  const configPath = claudeConfigPathFor(path, input.claudeDir);
  let document = yield* readDocument(configPath);
  for (const server of input.servers) {
    document = upsertClaudeMcpServer(document, server);
  }
  yield* writeDocument(configPath, document);
  return input.servers.map((server) => server.name);
});

/** Remove servers this plugin installed. Names it never added are ignored. */
export const removeClaudeMcpServers = Effect.fn("removeClaudeMcpServers")(function* (input: {
  readonly claudeDir: string;
  readonly names: ReadonlyArray<string>;
}): Effect.fn.Return<void, Error, FileSystem.FileSystem | Path.Path> {
  if (input.names.length === 0) return;
  const path = yield* Path.Path;
  const configPath = claudeConfigPathFor(path, input.claudeDir);
  let document = yield* readDocument(configPath);
  for (const name of input.names) {
    document = removeClaudeMcpServer(document, name);
  }
  yield* writeDocument(configPath, document);
});

/** Names currently configured at user scope, for collision reporting. */
export const listInstalledClaudeMcpServerNames = Effect.fn("listInstalledClaudeMcpServerNames")(
  function* (
    claudeDir: string,
  ): Effect.fn.Return<ReadonlyArray<string>, Error, FileSystem.FileSystem | Path.Path> {
    const path = yield* Path.Path;
    const document = yield* readDocument(claudeConfigPathFor(path, claudeDir));
    return listClaudeMcpServers(document).map((entry) => entry.name);
  },
);
