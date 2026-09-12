// FILE: codexMcpServers.ts
// Purpose: Installs and removes MCP servers in Codex's config.toml - the
//          mechanism behind connecting Gmail, Slack, Notion and the rest.
// Layer: Server connections
//
// Codex reads its MCP servers from `config.toml` in its home directory, so
// connecting a service means editing that file. The TOML manipulation itself
// lives in `@modesto/shared/codexMcpConfig`, which is pure and separately
// tested; this module owns only the file: where it is, and writing it safely.
//
// The path is a parameter rather than resolved here, so the caller decides
// which Codex home is being edited and tests can point at a temp directory.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  type CodexMcpServer,
  type CodexMcpServerInput,
  parseCodexMcpServers,
  removeCodexMcpServer,
  setCodexMcpServerEnabled,
  upsertCodexMcpServer,
} from "@modesto/shared/codexMcpConfig";

/** A missing config is an empty config; Codex creates it on first use. */
async function readOptional(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

/**
 * Writes through a temp file in the same directory, then renames.
 *
 * This file is Codex's own configuration and is read by a process outside our
 * control. A partial write from an interrupted save would not just lose a
 * connection - it could leave Codex unable to start.
 */
async function atomicWrite(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, contents, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
}

export async function listCodexMcpServers(configPath: string): Promise<CodexMcpServer[]> {
  return parseCodexMcpServers(await readOptional(configPath));
}

async function change(configPath: string, apply: (content: string) => string): Promise<void> {
  // Read and write are not atomic together. Two connections installed at the
  // same moment can still race; the caller serializes, and the alternative -
  // a lock file beside Codex's own config - is worse than the race.
  const current = await readOptional(configPath);
  const next = apply(current);
  if (next === current) return;
  await atomicWrite(configPath, next);
}

/** Adds a server, or replaces one already recorded under the same name. */
export async function installCodexMcpServer(
  configPath: string,
  input: CodexMcpServerInput,
): Promise<void> {
  await change(configPath, (content) => upsertCodexMcpServer(content, input));
}

export async function removeCodexMcpServerFromConfig(
  configPath: string,
  name: string,
): Promise<void> {
  await change(configPath, (content) => removeCodexMcpServer(content, name));
}

/**
 * Turns a server off without forgetting it.
 *
 * Disabling rather than removing keeps the URL and any OAuth client id, so
 * re-enabling does not mean reconnecting the service from scratch.
 */
export async function setCodexMcpServerEnabledInConfig(
  configPath: string,
  name: string,
  enabled: boolean,
): Promise<void> {
  await change(configPath, (content) => setCodexMcpServerEnabled(content, name, enabled));
}
