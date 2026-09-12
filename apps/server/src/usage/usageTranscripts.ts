/**
 * Pure parsers for the provider CLIs' on-disk session transcripts.
 *
 * Both parsers are line-at-a-time reducers so callers can stream large files
 * without materialising them. Neither touches the filesystem.
 *
 * @module usageTranscripts
 */
import type { UsageProviderKind, UsageTokenTotals } from "@modesto/contracts";

export interface UsageRecord {
  readonly provider: UsageProviderKind;
  readonly timestampMs: number;
  readonly model: string;
  readonly sessionId: string;
  readonly totals: UsageTokenTotals;
  readonly reportedCostUsd: number | null;
  /**
   * Key for cross-file de-duplication, or `null` when the record is inherently
   * unique and needs no dedup.
   */
  readonly dedupeKey: string | null;
}

const EMPTY_TOTALS: UsageTokenTotals = {
  uncachedInputTokens: 0,
  cachedInputTokens: 0,
  cacheCreationTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
};

function int(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

function parseTimestampMs(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function addTotals(a: UsageTokenTotals, b: UsageTokenTotals): UsageTokenTotals {
  return {
    uncachedInputTokens: a.uncachedInputTokens + b.uncachedInputTokens,
    cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens,
    cacheCreationTokens: a.cacheCreationTokens + b.cacheCreationTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    reasoningTokens: a.reasoningTokens + b.reasoningTokens,
  };
}

export function totalTokens(totals: UsageTokenTotals): number {
  // reasoningTokens is a subset of outputTokens and must not be added again.
  return (
    totals.uncachedInputTokens +
    totals.cachedInputTokens +
    totals.cacheCreationTokens +
    totals.outputTokens
  );
}

/**
 * Cheap substring gate applied before `JSON.parse`.
 *
 * Transcripts are mostly tool output; only a minority of lines carry usage. On
 * a 30-day window this skips roughly half the lines outright and is worth about
 * an order of magnitude.
 */
export function mightCarryUsage(line: string, provider: UsageProviderKind): boolean {
  switch (provider) {
    case "claude":
    case "pi":
      return line.includes('"usage"');
    case "codex":
      return line.includes('"token_count"');
    case "gemini":
      return (
        line.includes('"tokens"') ||
        line.includes('"sessionId"') ||
        line.includes("session_metadata") ||
        line.includes("message_update")
      );
    case "poolside":
      return line.includes("inference.");
    default:
      return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Claude Code                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Parses one line of a Claude Code transcript.
 *
 * Modesto writes one record per assistant *content block*, and every one of
 * those records repeats the same complete `usage` object for the parent
 * message. Summing them overcounts by roughly 2.4x on a real workload, so the
 * caller must drop repeats by `dedupeKey` and keep the first.
 */
export function parseClaudeLine(line: string): UsageRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const record = parsed as Record<string, unknown>;
  if (record["type"] !== "assistant") return null;

  const message = record["message"];
  if (typeof message !== "object" || message === null) return null;
  const messageRecord = message as Record<string, unknown>;

  const usage = messageRecord["usage"];
  if (typeof usage !== "object" || usage === null) return null;
  const usageRecord = usage as Record<string, unknown>;

  const timestampMs = parseTimestampMs(record["timestamp"]);
  if (timestampMs === null) return null;

  const model = typeof messageRecord["model"] === "string" ? messageRecord["model"] : "";
  if (model.length === 0) return null;

  const messageId = typeof messageRecord["id"] === "string" ? messageRecord["id"] : null;
  const requestId = typeof record["requestId"] === "string" ? record["requestId"] : null;
  // Matches ccusage: prefer the message/request pair, fall back to whichever
  // half exists. Records with neither cannot be de-duplicated.
  const dedupeKey =
    messageId === null && requestId === null ? null : `${messageId ?? ""}:${requestId ?? ""}`;

  const cost = record["costUSD"];

  return {
    provider: "claude",
    timestampMs,
    model,
    sessionId: typeof record["sessionId"] === "string" ? record["sessionId"] : "",
    totals: {
      uncachedInputTokens: int(usageRecord["input_tokens"]),
      cachedInputTokens: int(usageRecord["cache_read_input_tokens"]),
      cacheCreationTokens: int(usageRecord["cache_creation_input_tokens"]),
      outputTokens: int(usageRecord["output_tokens"]),
      // Anthropic folds thinking tokens into output and does not break them out.
      reasoningTokens: 0,
    },
    reportedCostUsd: typeof cost === "number" && Number.isFinite(cost) ? cost : null,
    dedupeKey,
  };
}

/* -------------------------------------------------------------------------- */
/* Codex                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Rolling state for a single Codex rollout file.
 *
 * Codex `token_count` events carry no model, so the model is carried forward
 * from the most recent `turn_context`. Sessions that switch models mid-run
 * attribute correctly from the switch onward.
 */
export interface CodexScanState {
  model: string;
  sessionId: string;
  lastUsageSignature: string | null;
  sawSessionMeta: boolean;
  /** While true, leading usage events are re-stamped copies of parent history. */
  suppressingForkCopies: boolean;
  forkCopyAnchorMs: number;
}

export function initialCodexScanState(): CodexScanState {
  return {
    model: "",
    sessionId: "",
    lastUsageSignature: null,
    sawSessionMeta: false,
    suppressingForkCopies: false,
    forkCopyAnchorMs: 0,
  };
}

/**
 * A forked or subagent rollout opens with the parent's full history copied in,
 * every line re-stamped to the fork instant. Those copies are written in one
 * synchronous burst (observed gaps 0-40ms), while the child's first genuine
 * usage event only lands after a real model turn (observed 5s+). One second of
 * separation splits the two cleanly; `ccusage` uses the same threshold.
 */
const FORK_COPY_MAX_GAP_MS = 1000;

/** Whether a `session_meta` payload marks the rollout as a fork or subagent. */
function isForkedSessionMeta(payload: Record<string, unknown>): boolean {
  if (typeof payload["forked_from_id"] === "string") return true;
  const source = payload["source"];
  if (typeof source !== "object" || source === null) return false;
  const subagent = (source as Record<string, unknown>)["subagent"];
  if (typeof subagent !== "object" || subagent === null) return false;
  const spawn = (subagent as Record<string, unknown>)["thread_spawn"];
  if (typeof spawn !== "object" || spawn === null) return false;
  return typeof (spawn as Record<string, unknown>)["parent_thread_id"] === "string";
}

/**
 * Feeds one line of a Codex rollout into `state`, returning a record when the
 * line was a usage event.
 *
 * Deltas come from `last_token_usage`. Summing those across a session
 * reconciles with the session's final `total_token_usage`, provided
 * consecutive duplicate events are dropped, which this does.
 */
export function parseCodexLine(line: string, state: CodexScanState): UsageRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const record = parsed as Record<string, unknown>;
  const payload = record["payload"];
  if (typeof payload !== "object" || payload === null) return null;
  const payloadRecord = payload as Record<string, unknown>;
  const payloadType = payloadRecord["type"];

  if (record["type"] === "session_meta") {
    // Only the first meta describes this file's own session. A forked rollout
    // repeats the ancestors' metas right after it; letting those through would
    // reassign every subsequent record to an ancestor session.
    if (state.sawSessionMeta) return null;
    state.sawSessionMeta = true;
    const id = payloadRecord["id"] ?? payloadRecord["session_id"];
    if (typeof id === "string") state.sessionId = id;
    const metaTimestampMs = parseTimestampMs(record["timestamp"]);
    if (metaTimestampMs !== null && isForkedSessionMeta(payloadRecord)) {
      state.suppressingForkCopies = true;
      state.forkCopyAnchorMs = metaTimestampMs;
    }
    return null;
  }

  if (record["type"] === "turn_context") {
    if (typeof payloadRecord["model"] === "string") state.model = payloadRecord["model"];
    return null;
  }

  if (payloadType !== "token_count") return null;

  const info = payloadRecord["info"];
  if (typeof info !== "object" || info === null) return null;
  const last = (info as Record<string, unknown>)["last_token_usage"];
  if (typeof last !== "object" || last === null) return null;
  const lastRecord = last as Record<string, unknown>;

  // Only an event that is otherwise eligible may consume the duplicate
  // signature. A token_count arriving before its turn_context (no model yet)
  // must not poison it, or the re-emitted copy after the model is known would
  // be skipped as a duplicate and those tokens never counted.
  const timestampMs = parseTimestampMs(record["timestamp"]);
  if (timestampMs === null) return null;
  if (state.model.length === 0) return null;

  // Codex re-emits an unchanged token_count on some stream boundaries. Summing
  // those would double count, so identical consecutive payloads are skipped.
  const signature = JSON.stringify(lastRecord);
  if (signature === state.lastUsageSignature) return null;
  state.lastUsageSignature = signature;

  // In a forked rollout the copied parent history was already counted from the
  // parent's own file. Drop the leading burst; the first usage event separated
  // from its predecessor by a real turn's worth of time ends it for good.
  if (state.suppressingForkCopies) {
    if (timestampMs - state.forkCopyAnchorMs < FORK_COPY_MAX_GAP_MS) {
      state.forkCopyAnchorMs = timestampMs;
      return null;
    }
    state.suppressingForkCopies = false;
  }

  const inputTokens = int(lastRecord["input_tokens"]);
  const cachedInputTokens = int(lastRecord["cached_input_tokens"]);
  const cacheCreationTokens = int(lastRecord["cache_write_input_tokens"]);
  const outputTokens = int(lastRecord["output_tokens"]);

  const totals: UsageTokenTotals = {
    // Codex reports `input_tokens` inclusive of the cached portion.
    uncachedInputTokens: Math.max(0, inputTokens - cachedInputTokens - cacheCreationTokens),
    cachedInputTokens,
    cacheCreationTokens,
    outputTokens,
    // Reported inside output_tokens, surfaced separately for the token mix.
    reasoningTokens: Math.min(outputTokens, int(lastRecord["reasoning_output_tokens"])),
  };

  if (totalTokens(totals) === 0) return null;

  return {
    provider: "codex",
    timestampMs,
    model: state.model,
    sessionId: state.sessionId,
    totals,
    // Codex does not report cost in the rollout.
    reportedCostUsd: null,
    // Events surviving the fork-copy suppression above are unique to this
    // rollout, so they need no global dedup.
    dedupeKey: null,
  };
}

/* -------------------------------------------------------------------------- */
/* OpenCode / Kilo                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Parses one row of the OpenCode (or Kilo, which forks OpenCode's storage
 * schema wholesale) `message` table.
 *
 * Unlike Claude and Codex, which write append-only JSONL transcripts, OpenCode
 * persists to a local SQLite database (`opencode.db` / `kilo.db`) with one row
 * per message; each assistant row's `data` JSON column already carries priced,
 * per-message token totals and cost, so there is no cross-line reduction to do
 * — every row is a complete record.
 */
export function parseOpenCodeMessageRow(
  provider: "opencode" | "kilo",
  messageId: string,
  sessionId: string,
  dataJson: string,
): UsageRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(dataJson);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  if (record["role"] !== "assistant") return null;

  const model = typeof record["modelID"] === "string" ? record["modelID"] : "";
  if (model.length === 0) return null;

  const time = record["time"];
  const timestampMs =
    typeof time === "object" && time !== null
      ? parseTimestampMsFromEpoch((time as Record<string, unknown>)["created"])
      : null;
  if (timestampMs === null) return null;

  const tokens = record["tokens"];
  const tokensRecord =
    typeof tokens === "object" && tokens !== null ? (tokens as Record<string, unknown>) : {};
  const cache = tokensRecord["cache"];
  const cacheRecord =
    typeof cache === "object" && cache !== null ? (cache as Record<string, unknown>) : {};

  const totals: UsageTokenTotals = {
    uncachedInputTokens: int(tokensRecord["input"]),
    cachedInputTokens: int(cacheRecord["read"]),
    cacheCreationTokens: int(cacheRecord["write"]),
    outputTokens: int(tokensRecord["output"]),
    reasoningTokens: Math.min(int(tokensRecord["output"]), int(tokensRecord["reasoning"])),
  };
  if (totalTokens(totals) === 0) return null;

  const cost = record["cost"];

  return {
    provider,
    timestampMs,
    model,
    sessionId,
    totals,
    reportedCostUsd: typeof cost === "number" && Number.isFinite(cost) ? cost : null,
    // One row per message id; the table itself is the unique source of truth.
    dedupeKey: messageId,
  };
}

function parseTimestampMsFromEpoch(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/* -------------------------------------------------------------------------- */
/* Gemini CLI                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Rolling state for a Gemini session file. Session id lives on the metadata
 * line (or the first message that carries one); later `gemini` /
 * `message_update` lines inherit it for dedupe.
 */
export interface GeminiScanState {
  sessionId: string;
  /** Model carried forward when a `message_update` omits it. */
  lastModelByMessageId: Map<string, string>;
}

export function initialGeminiScanState(): GeminiScanState {
  return { sessionId: "", lastModelByMessageId: new Map() };
}

/**
 * Parses one Gemini CLI session line (`type: "gemini"` or `message_update`
 * with tokens, plus session metadata).
 *
 * Token mapping follows tokenuse/OpenUsage: cached is a subset of input;
 * thoughts fold into output for billing while staying visible as reasoning.
 */
export function parseGeminiLine(line: string, state: GeminiScanState): UsageRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;

  if (
    record["type"] === "session_metadata" ||
    (typeof record["sessionId"] === "string" &&
      record["type"] === undefined &&
      !("tokens" in record))
  ) {
    if (typeof record["sessionId"] === "string") state.sessionId = record["sessionId"];
    return null;
  }

  // `$set` / user / tool lines never carry billable totals.
  if (record["type"] === "user" || record["$set"] !== undefined) return null;

  const isGeminiMessage = record["type"] === "gemini" || record["type"] === "model";
  const isUpdate = record["type"] === "message_update";
  if (!isGeminiMessage && !isUpdate) return null;

  const tokens = record["tokens"];
  if (typeof tokens !== "object" || tokens === null) return null;
  const tokensRecord = tokens as Record<string, unknown>;

  const messageId = typeof record["id"] === "string" ? record["id"] : null;
  let model = typeof record["model"] === "string" ? record["model"] : "";
  if (model.length === 0 && messageId !== null) {
    model = state.lastModelByMessageId.get(messageId) ?? "";
  }
  if (model.length === 0) return null;
  if (messageId !== null) state.lastModelByMessageId.set(messageId, model);

  if (typeof record["sessionId"] === "string" && record["sessionId"].length > 0) {
    state.sessionId = record["sessionId"];
  }

  const timestampMs = parseTimestampMs(record["timestamp"]);
  if (timestampMs === null) return null;

  const cached = int(tokensRecord["cached"]);
  const input = int(tokensRecord["input"]);
  const output = int(tokensRecord["output"]);
  const tool = int(tokensRecord["tool"]);
  const thoughts = int(tokensRecord["thoughts"]);
  const total = int(tokensRecord["total"]);
  const accounted = input + output + tool + thoughts;
  const remainder = total > accounted ? total - accounted : 0;

  const totals: UsageTokenTotals = {
    uncachedInputTokens: Math.max(0, input - cached),
    cachedInputTokens: cached,
    cacheCreationTokens: 0,
    outputTokens: output + tool + thoughts + remainder,
    reasoningTokens: thoughts,
  };
  if (totalTokens(totals) === 0) return null;

  return {
    provider: "gemini",
    timestampMs,
    model,
    sessionId: state.sessionId,
    totals,
    reportedCostUsd: null,
    dedupeKey:
      messageId === null
        ? null
        : `gemini:${state.sessionId}:${messageId}:${totals.uncachedInputTokens}:${totals.outputTokens}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Pi                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Parses one Pi coding-agent session line. Assistant messages carry
 * `usage.{input,output,cacheRead,cacheWrite}` plus a precomputed `cost.total`.
 */
export function parsePiLine(line: string): UsageRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;

  // Compaction / branch summaries can also carry usage; count them too when
  // they look like assistant turns with a model.
  const message =
    record["type"] === "message" &&
    typeof record["message"] === "object" &&
    record["message"] !== null
      ? (record["message"] as Record<string, unknown>)
      : record["role"] === "assistant"
        ? record
        : null;
  if (message === null) return null;
  if (message["role"] !== "assistant" && record["type"] !== "compaction") return null;

  const usage = message["usage"] ?? record["usage"];
  if (typeof usage !== "object" || usage === null) return null;
  const usageRecord = usage as Record<string, unknown>;

  const model =
    typeof message["model"] === "string"
      ? message["model"]
      : typeof record["model"] === "string"
        ? record["model"]
        : "";
  if (model.length === 0) return null;

  const timestampMs =
    parseTimestampMs(record["timestamp"]) ??
    parseTimestampMs(message["timestamp"]) ??
    parseTimestampMsFromEpoch(record["timestampMs"]);
  if (timestampMs === null) return null;

  const outputTokens = int(usageRecord["output"]);
  const totals: UsageTokenTotals = {
    uncachedInputTokens: int(usageRecord["input"]),
    cachedInputTokens: int(usageRecord["cacheRead"]),
    cacheCreationTokens: int(usageRecord["cacheWrite"]),
    outputTokens,
    reasoningTokens: 0,
  };
  if (totalTokens(totals) === 0) return null;

  const cost = usageRecord["cost"];
  const costTotal =
    typeof cost === "object" && cost !== null
      ? (cost as Record<string, unknown>)["total"]
      : typeof cost === "number"
        ? cost
        : null;

  const entryId = typeof record["id"] === "string" ? record["id"] : null;
  const sessionId =
    typeof record["sessionId"] === "string"
      ? record["sessionId"]
      : typeof message["sessionId"] === "string"
        ? message["sessionId"]
        : "";

  return {
    provider: "pi",
    timestampMs,
    model,
    sessionId,
    totals,
    reportedCostUsd: typeof costTotal === "number" && Number.isFinite(costTotal) ? costTotal : null,
    dedupeKey: entryId === null ? null : `pi:${entryId}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Poolside trajectories                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Rolling state for a Poolside NDJSON trajectory: model arrives on
 * `tool_call.inference.start`, tokens on the matching `…end`.
 */
export interface PoolsideScanState {
  /** Most recent model from an inference.start in this file. */
  model: string;
  sessionId: string;
}

export function initialPoolsideScanState(sessionId = ""): PoolsideScanState {
  return { model: "", sessionId };
}

/**
 * Parses one Poolside trajectory NDJSON line. Tokens live on
 * `tool_call.inference.end`; the model is taken from the preceding
 * `tool_call.inference.start` (`chat_completion_request.model`).
 */
export function parsePoolsideLine(line: string, state: PoolsideScanState): UsageRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  const type = record["type"];

  if (type === "tool_call.inference.start") {
    const start = record["tool_call_inference_start"];
    if (typeof start === "object" && start !== null) {
      const request = (start as Record<string, unknown>)["chat_completion_request"];
      if (typeof request === "object" && request !== null) {
        const model = (request as Record<string, unknown>)["model"];
        if (typeof model === "string" && model.length > 0) state.model = model;
      }
    }
    return null;
  }

  if (type !== "tool_call.inference.end") return null;
  if (state.model.length === 0) return null;

  const end = record["tool_call_inference_end"];
  if (typeof end !== "object" || end === null) return null;
  const endRecord = end as Record<string, unknown>;

  const timestampMs = parseTimestampMs(record["timestamp"]);
  if (timestampMs === null) return null;

  const cachedRead = int(endRecord["cache_read_input_tokens"]);
  const cacheWrite = int(endRecord["cache_write_input_tokens"]);
  const inputTokens = int(endRecord["input_tokens"]);
  const outputTokens = int(endRecord["output_tokens"]);

  const totals: UsageTokenTotals = {
    uncachedInputTokens: Math.max(0, inputTokens - cachedRead - cacheWrite),
    cachedInputTokens: cachedRead,
    cacheCreationTokens: cacheWrite,
    outputTokens,
    reasoningTokens: 0,
  };
  if (totalTokens(totals) === 0) return null;

  const eventId = typeof record["id"] === "string" ? record["id"] : null;

  return {
    provider: "poolside",
    timestampMs,
    model: state.model,
    sessionId: state.sessionId,
    totals,
    reportedCostUsd: null,
    dedupeKey: eventId === null ? null : `poolside:${eventId}`,
  };
}

/* -------------------------------------------------------------------------- */
/* GitHub Copilot session-store                                               */
/* -------------------------------------------------------------------------- */

/**
 * Parses one `assistant_usage_events` row from Copilot's `session-store.db`.
 */
export function parseGithubCopilotUsageRow(row: {
  readonly id: number | string;
  readonly session_id: string;
  readonly model: string;
  readonly input_tokens: number | null;
  readonly output_tokens: number | null;
  readonly cache_read_tokens: number | null;
  readonly cache_write_tokens: number | null;
  readonly reasoning_tokens: number | null;
  readonly created_at: string | null;
}): UsageRecord | null {
  const model = row.model.trim();
  if (model.length === 0) return null;

  const timestampMs =
    row.created_at === null || row.created_at.length === 0
      ? null
      : // SQLite `datetime('now')` is UTC without a Z suffix.
        parseTimestampMs(row.created_at.endsWith("Z") ? row.created_at : `${row.created_at}Z`);
  if (timestampMs === null) return null;

  const cachedRead = int(row.cache_read_tokens);
  const cacheWrite = int(row.cache_write_tokens);
  const inputTokens = int(row.input_tokens);
  const outputTokens = int(row.output_tokens);
  const reasoning = int(row.reasoning_tokens);

  const totals: UsageTokenTotals = {
    uncachedInputTokens: Math.max(0, inputTokens - cachedRead - cacheWrite),
    cachedInputTokens: cachedRead,
    cacheCreationTokens: cacheWrite,
    outputTokens,
    reasoningTokens: Math.min(outputTokens, reasoning),
  };
  if (totalTokens(totals) === 0) return null;

  return {
    provider: "githubCopilot",
    timestampMs,
    model,
    sessionId: row.session_id,
    totals,
    reportedCostUsd: null,
    dedupeKey: `githubCopilot:${row.id}`,
  };
}

export { EMPTY_TOTALS };
