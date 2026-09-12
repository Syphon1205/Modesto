// @effect-diagnostics nodeBuiltinImport:off
/// <reference types="bun" />
/**
 * Raw filesystem access for transcript scanning.
 *
 * Isolated here so the rest of the usage code stays on Effect's `FileSystem`.
 * The direct `node:fs` streaming is deliberate: a cold 30-day window is ~1.4 GB
 * across ~1,500 files, and `readline` over a read stream is roughly an order of
 * magnitude cheaper than materialising each file. The equivalent Effect stream
 * pipeline is idiomatic but not fast enough to sit behind a page load.
 *
 * OpenCode, Kilo, and GitHub Copilot are read the same raw way, via `bun:sqlite`,
 * for the same reason: their usage lives in a SQLite database, not a directory
 * this module would otherwise walk.
 *
 * @module usageTranscriptReader
 */
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import * as NodeReadline from "node:readline";

import type { UsageProviderKind } from "@modesto/contracts";

import {
  initialCodexScanState,
  initialGeminiScanState,
  initialPoolsideScanState,
  mightCarryUsage,
  parseClaudeLine,
  parseCodexLine,
  parseGeminiLine,
  parseGithubCopilotUsageRow,
  parseOpenCodeMessageRow,
  parsePiLine,
  parsePoolsideLine,
  type UsageRecord,
} from "./usageTranscripts.ts";

/**
 * Providers whose usage lives in a single SQLite database file rather than a
 * directory of append-only JSONL transcripts. `root` for these providers is the
 * direct path to that `.db` file, not a directory to walk.
 */
function isSqliteBackedProvider(
  provider: UsageProviderKind,
): provider is "opencode" | "kilo" | "githubCopilot" {
  return provider === "opencode" || provider === "kilo" || provider === "githubCopilot";
}

function isTranscriptFileName(name: string, provider: UsageProviderKind): boolean {
  if (provider === "poolside") return name.endsWith(".ndjson") || name.endsWith(".jsonl");
  if (provider === "gemini") {
    return (
      (name.startsWith("session-") && (name.endsWith(".jsonl") || name.endsWith(".json"))) ||
      name.endsWith(".jsonl")
    );
  }
  return name.endsWith(".jsonl");
}

export interface TranscriptFile {
  readonly path: string;
  readonly size: number;
  readonly mtimeMs: number;
}

/**
 * Lists the transcript file(s) under `root` for `provider`, last modified at
 * or after `sinceMs`.
 *
 * For JSONL-backed providers this walks `root` for transcript files. For
 * SQLite-backed providers (see {@link isSqliteBackedProvider}) `root` is
 * already the direct path to the one database file to scan.
 *
 * Errors on individual entries are swallowed: session files rotate and get
 * removed while the walk is in flight, and a partial listing is far better than
 * failing the page.
 */
export async function listTranscriptFiles(
  root: string,
  sinceMs: number,
  provider: UsageProviderKind,
): Promise<readonly TranscriptFile[]> {
  if (isSqliteBackedProvider(provider)) {
    try {
      const stats = await NodeFSP.stat(root);
      // The DB is a single, frequently-mutated file, not an append-only log,
      // so `sinceMs` cannot gate it the way it gates JSONL files: every row is
      // read and cached under this file's (size, mtime) regardless of window,
      // exactly like a single still-growing JSONL session file, and the
      // aggregator applies the window filter per-record as usual.
      return [{ path: root, size: stats.size, mtimeMs: stats.mtimeMs }];
    } catch {
      return [];
    }
  }

  const found: TranscriptFile[] = [];

  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await NodeFSP.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const child = NodePath.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Gemini's Antigravity subtree is not billable CLI chat usage.
        if (provider === "gemini" && entry.name === "antigravity") continue;
        await walk(child);
        continue;
      }
      if (!isTranscriptFileName(entry.name, provider)) continue;
      try {
        const stats = await NodeFSP.stat(child);
        if (stats.mtimeMs >= sinceMs) {
          found.push({ path: child, size: stats.size, mtimeMs: stats.mtimeMs });
        }
      } catch {
        // Vanished between readdir and stat.
      }
    }
  };

  await walk(root);
  return found;
}

/**
 * Filesystem identity of a directory, as `device:inode`.
 *
 * Used to tell "two servers reading the same transcript directory" apart from
 * "two machines whose hostname and home path happen to match". Returns an empty
 * string when the directory cannot be stat'd.
 */
export async function readDirectoryVolumeId(path: string): Promise<string> {
  try {
    const stats = await NodeFSP.stat(path);
    return `${stats.dev}:${stats.ino}`;
  } catch {
    return "";
  }
}

/**
 * Streams one transcript and returns the usage records it contains, or `null`
 * when the file could not be read.
 *
 * The distinction matters to the caller's cache: a genuinely empty transcript
 * is a stable fact worth memoising, while a transient read failure memoised
 * under the same `(size, mtime)` key would silently drop that file's usage
 * until the file next changes.
 *
 * Codex carries the active model on `turn_context` lines that hold no usage of
 * their own, so those still have to pass through the reducer to keep model
 * attribution correct. Gemini and Poolside similarly need non-usage lines for
 * session/model state.
 */
export async function readTranscriptRecords(
  filePath: string,
  provider: UsageProviderKind,
): Promise<readonly UsageRecord[] | null> {
  if (provider === "opencode" || provider === "kilo") {
    return readOpenCodeFamilyDatabase(filePath, provider);
  }
  if (provider === "githubCopilot") {
    return readGithubCopilotDatabase(filePath);
  }

  // Legacy Gemini monolithic JSON session files (pre-JSONL migration).
  if (provider === "gemini" && filePath.endsWith(".json") && !filePath.endsWith(".jsonl")) {
    return readGeminiJsonSession(filePath);
  }

  const records: UsageRecord[] = [];
  const codexState = initialCodexScanState();
  const geminiState = initialGeminiScanState();
  const poolsideState = initialPoolsideScanState(
    provider === "poolside" ? NodePath.basename(filePath, NodePath.extname(filePath)) : "",
  );

  try {
    const lines = NodeReadline.createInterface({
      input: NodeFS.createReadStream(filePath, { encoding: "utf8" }),
      crlfDelay: Infinity,
    });

    for await (const line of lines) {
      if (provider === "codex") {
        if (
          !mightCarryUsage(line, provider) &&
          !line.includes('"turn_context"') &&
          !line.includes('"session_meta"')
        ) {
          continue;
        }
        const record = parseCodexLine(line, codexState);
        if (record !== null) records.push(record);
        continue;
      }

      if (provider === "gemini") {
        if (!mightCarryUsage(line, provider)) continue;
        const record = parseGeminiLine(line, geminiState);
        if (record !== null) records.push(record);
        continue;
      }

      if (provider === "pi") {
        if (!mightCarryUsage(line, provider)) continue;
        const record = parsePiLine(line);
        if (record !== null) records.push(record);
        continue;
      }

      if (provider === "poolside") {
        if (!mightCarryUsage(line, provider)) continue;
        const record = parsePoolsideLine(line, poolsideState);
        if (record !== null) records.push(record);
        continue;
      }

      // Default: Claude-shaped JSONL.
      if (!mightCarryUsage(line, provider)) continue;
      const record = parseClaudeLine(line);
      if (record !== null) records.push(record);
    }
  } catch {
    return null;
  }

  return records;
}

/**
 * Reads every assistant message row out of an OpenCode-family SQLite database
 * (`opencode.db` / `kilo.db`).
 *
 * Unlike the JSONL providers there is no line-at-a-time streaming to do: the
 * `message` table already holds one JSON blob per message, so this is a single
 * bulk `SELECT`. Opened read-only so a concurrently-running CLI never sees us
 * as a writer.
 */
async function readOpenCodeFamilyDatabase(
  filePath: string,
  provider: "opencode" | "kilo",
): Promise<readonly UsageRecord[] | null> {
  let db: import("bun:sqlite").Database | null = null;
  try {
    const { Database } = await import("bun:sqlite");
    db = new Database(filePath, { readonly: true, strict: true });
    const rows = db
      .query<{ id: string; session_id: string; data: string }, []>(
        "SELECT id, session_id, data FROM message WHERE data LIKE '%\"tokens\"%'",
      )
      .all();

    const records: UsageRecord[] = [];
    for (const row of rows) {
      const record = parseOpenCodeMessageRow(provider, row.id, row.session_id, row.data);
      if (record !== null) records.push(record);
    }
    return records;
  } catch {
    // Covers a missing file, a schema this build does not recognise yet, and
    // "the CLI is mid-write and holds a lock" — all transient from this
    // reader's point of view, not "this provider has zero usage".
    return null;
  } finally {
    db?.close();
  }
}

/**
 * Reads `assistant_usage_events` from GitHub Copilot's `session-store.db`.
 */
async function readGithubCopilotDatabase(filePath: string): Promise<readonly UsageRecord[] | null> {
  let db: import("bun:sqlite").Database | null = null;
  try {
    const { Database } = await import("bun:sqlite");
    db = new Database(filePath, { readonly: true, strict: true });
    const rows = db
      .query<
        {
          id: number;
          session_id: string;
          model: string;
          input_tokens: number | null;
          output_tokens: number | null;
          cache_read_tokens: number | null;
          cache_write_tokens: number | null;
          reasoning_tokens: number | null;
          created_at: string | null;
        },
        []
      >(
        `SELECT id, session_id, model, input_tokens, output_tokens,
                cache_read_tokens, cache_write_tokens, reasoning_tokens, created_at
         FROM assistant_usage_events`,
      )
      .all();

    const records: UsageRecord[] = [];
    for (const row of rows) {
      const record = parseGithubCopilotUsageRow(row);
      if (record !== null) records.push(record);
    }
    return records;
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

/**
 * Legacy Gemini session files store the whole conversation as one JSON object
 * with a `messages` array. Flatten those into the same records the JSONL
 * parser would emit.
 */
async function readGeminiJsonSession(filePath: string): Promise<readonly UsageRecord[] | null> {
  try {
    const raw = await NodeFSP.readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return [];
    const root = parsed as Record<string, unknown>;
    const state = initialGeminiScanState();
    if (typeof root["sessionId"] === "string") state.sessionId = root["sessionId"];

    const messages = root["messages"];
    if (!Array.isArray(messages)) return [];

    const records: UsageRecord[] = [];
    for (const message of messages) {
      if (typeof message !== "object" || message === null) continue;
      const record = parseGeminiLine(JSON.stringify(message), state);
      if (record !== null) records.push(record);
    }
    return records;
  } catch {
    return null;
  }
}
