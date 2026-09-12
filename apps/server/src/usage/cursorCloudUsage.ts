// @effect-diagnostics nodeBuiltinImport:off
/// <reference types="bun" />
/**
 * Cursor cloud usage — fills the usage page for Cursor from Cursor's billing
 * APIs rather than local transcripts (which do not carry token totals).
 *
 * Auth order:
 *   1. Optional Enterprise Admin API key from settings → `api.cursor.com`
 *   2. Machine-local Cursor login token (IDE state DB / auth.json / keychain)
 *      → unofficial `api2.cursor.sh` DashboardService (OpenUsage-style)
 *
 * Failures are returned as a UsageSource with status `"failed"` / `"missing"`
 * so local scanners can still succeed.
 *
 * @module cursorCloudUsage
 */
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { promisify } from "node:util";

import type { UsageSource } from "@modesto/contracts";

import { makeDayFormatter } from "./usageAggregation.ts";
import type { UsageRecord } from "./usageTranscripts.ts";

const execFile = promisify(NodeChildProcess.execFile);

const DASHBOARD_RPC_BASE = "https://api2.cursor.sh";
const ADMIN_API_BASE = "https://api.cursor.com";

export interface CursorCloudUsageInput {
  readonly hostId: string;
  readonly timeZone: string;
  readonly sinceDay: string;
  readonly untilDay: string;
  readonly sinceTimeMs?: number;
  readonly untilTimeMs?: number;
  /** Enterprise Admin API key from Cursor settings, when present. */
  readonly adminApiKey: string | null;
  readonly fetch: typeof globalThis.fetch;
}

export interface CursorCloudUsageResult {
  readonly source: UsageSource;
  readonly records: readonly UsageRecord[];
}

function emptySource(
  hostId: string,
  status: UsageSource["status"],
  message: string | null,
): UsageSource {
  return {
    fingerprint: {
      hostId,
      provider: "cursor",
      resolvedHomePath: "(cursor-cloud)",
      volumeId: "",
    },
    status,
    scannedFiles: 0,
    skippedFiles: 0,
    malformedRecords: 0,
    distinctSessions: 0,
    message,
  };
}

function int(value: unknown): number {
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
  }
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

function centsToUsd(cents: unknown): number | null {
  const value =
    typeof cents === "string" ? Number(cents) : typeof cents === "number" ? cents : Number.NaN;
  if (!Number.isFinite(value)) return null;
  return value / 100;
}

/**
 * Maps Cursor dashboard / admin aggregation rows into Modesto usage records.
 *
 * Cycle-scoped aggregates have no per-day breakdown; they are attributed to
 * `attributionDay` (typically the later of cycle start and window start) so
 * they appear inside the selected window without inventing daily detail.
 */
export function mapCursorAggregationsToRecords(input: {
  readonly aggregations: readonly unknown[];
  readonly attributionDay: string;
  readonly timeZone: string;
  readonly sessionId: string;
}): readonly UsageRecord[] {
  const dayStartMs = Date.parse(`${input.attributionDay}T12:00:00Z`);
  const timestampMs = Number.isFinite(dayStartMs) ? dayStartMs : Date.now();
  const records: UsageRecord[] = [];

  for (const [index, row] of input.aggregations.entries()) {
    if (typeof row !== "object" || row === null) continue;
    const record = row as Record<string, unknown>;
    const model =
      typeof record["modelIntent"] === "string"
        ? record["modelIntent"]
        : typeof record["model"] === "string"
          ? record["model"]
          : "";
    if (model.length === 0) continue;

    const tokenUsage =
      typeof record["tokenUsage"] === "object" && record["tokenUsage"] !== null
        ? (record["tokenUsage"] as Record<string, unknown>)
        : record;

    const cachedRead = int(tokenUsage["cacheReadTokens"] ?? tokenUsage["cachedInputTokens"]);
    const cacheWrite = int(tokenUsage["cacheWriteTokens"]);
    const inputTokens = int(tokenUsage["inputTokens"]);
    const outputTokens = int(tokenUsage["outputTokens"]);
    const costUsd =
      centsToUsd(record["totalCents"] ?? tokenUsage["totalCents"] ?? record["chargedCents"]) ??
      null;

    const totals = {
      uncachedInputTokens: Math.max(0, inputTokens - cachedRead - cacheWrite),
      cachedInputTokens: cachedRead,
      cacheCreationTokens: cacheWrite,
      outputTokens,
      reasoningTokens: 0,
    };
    if (
      totals.uncachedInputTokens +
        totals.cachedInputTokens +
        totals.cacheCreationTokens +
        totals.outputTokens ===
      0
    ) {
      continue;
    }

    records.push({
      provider: "cursor",
      timestampMs,
      model,
      sessionId: input.sessionId,
      totals,
      reportedCostUsd: costUsd,
      dedupeKey: `cursor-cloud:${input.attributionDay}:${model}:${index}`,
    });
  }

  return records;
}

/** Maps Admin API filtered usage events into per-event records. */
export function mapCursorFilteredEventsToRecords(input: {
  readonly events: readonly unknown[];
  readonly timeZone: string;
  readonly sinceDay: string;
  readonly untilDay: string;
}): readonly UsageRecord[] {
  const toDay = makeDayFormatter(input.timeZone);
  const records: UsageRecord[] = [];

  for (const [index, event] of input.events.entries()) {
    if (typeof event !== "object" || event === null) continue;
    const row = event as Record<string, unknown>;
    const timestampRaw =
      typeof row["timestamp"] === "string"
        ? row["timestamp"]
        : typeof row["createdAt"] === "string"
          ? row["createdAt"]
          : null;
    if (timestampRaw === null) continue;
    const timestampMs = Date.parse(timestampRaw);
    if (!Number.isFinite(timestampMs)) continue;

    const day = toDay(timestampMs);
    if (day < input.sinceDay || day > input.untilDay) continue;

    const model =
      typeof row["model"] === "string"
        ? row["model"]
        : typeof row["modelIntent"] === "string"
          ? row["modelIntent"]
          : "";
    if (model.length === 0) continue;

    const tokenUsage =
      typeof row["tokenUsage"] === "object" && row["tokenUsage"] !== null
        ? (row["tokenUsage"] as Record<string, unknown>)
        : {};
    const cachedRead = int(tokenUsage["cacheReadTokens"]);
    const cacheWrite = int(tokenUsage["cacheWriteTokens"]);
    const inputTokens = int(tokenUsage["inputTokens"]);
    const outputTokens = int(tokenUsage["outputTokens"]);
    const costUsd = centsToUsd(row["chargedCents"] ?? tokenUsage["totalCents"]);

    const totals = {
      uncachedInputTokens: Math.max(0, inputTokens - cachedRead - cacheWrite),
      cachedInputTokens: cachedRead,
      cacheCreationTokens: cacheWrite,
      outputTokens,
      reasoningTokens: 0,
    };
    if (
      totals.uncachedInputTokens +
        totals.cachedInputTokens +
        totals.cacheCreationTokens +
        totals.outputTokens ===
      0
    ) {
      continue;
    }

    const eventId =
      typeof row["id"] === "string"
        ? row["id"]
        : typeof row["eventId"] === "string"
          ? row["eventId"]
          : String(index);

    records.push({
      provider: "cursor",
      timestampMs,
      model,
      sessionId: typeof row["userId"] === "string" ? row["userId"] : "cursor-cloud",
      totals,
      reportedCostUsd: costUsd,
      dedupeKey: `cursor-event:${eventId}`,
    });
  }

  return records;
}

async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await NodeFSP.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function decodeJwtSub(token: string): string | null {
  const parts = token.split(".");
  if (parts.length < 2 || parts[1] === undefined) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      sub?: unknown;
    };
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Locates a Cursor access token already present on this machine (IDE login /
 * CLI auth). Never logs the token.
 */
export async function readLocalCursorAccessToken(): Promise<string | null> {
  const home = NodeOS.homedir();
  const candidates = [
    NodePath.join(home, ".config", "cursor", "auth.json"),
    NodePath.join(home, ".cursor", "auth.json"),
  ];
  for (const candidate of candidates) {
    const raw = await readFileIfExists(candidate);
    if (raw === null) continue;
    try {
      const parsed = JSON.parse(raw) as { accessToken?: unknown; token?: unknown };
      const token =
        typeof parsed.accessToken === "string"
          ? parsed.accessToken
          : typeof parsed.token === "string"
            ? parsed.token
            : null;
      if (token && token.length > 0) return token;
    } catch {
      // Try the next candidate.
    }
  }

  const stateDbCandidates = [
    NodePath.join(
      home,
      "Library",
      "Application Support",
      "Cursor",
      "User",
      "globalStorage",
      "state.vscdb",
    ),
    NodePath.join(home, ".config", "Cursor", "User", "globalStorage", "state.vscdb"),
    NodePath.join(
      process.env["APPDATA"] ?? NodePath.join(home, "AppData", "Roaming"),
      "Cursor",
      "User",
      "globalStorage",
      "state.vscdb",
    ),
  ];

  for (const dbPath of stateDbCandidates) {
    try {
      if (!NodeFS.existsSync(dbPath)) continue;
      const { Database } = await import("bun:sqlite");
      const db = new Database(dbPath, { readonly: true, strict: true });
      try {
        const row = db
          .query<{ value: string }, [string]>("SELECT value FROM ItemTable WHERE key = ? LIMIT 1")
          .get("cursorAuth/accessToken");
        if (row && typeof row.value === "string" && row.value.length > 0) return row.value;
      } finally {
        db.close();
      }
    } catch {
      // Try keychain / next path.
    }
  }

  if (process.platform === "darwin") {
    try {
      const { stdout } = await execFile("/usr/bin/security", [
        "find-generic-password",
        "-s",
        "cursor-access-token",
        "-w",
      ]);
      const token = stdout.trim();
      if (token.length > 0) return token;
    } catch {
      // No keychain entry.
    }
  }

  return null;
}

async function postJson(
  fetchImpl: typeof globalThis.fetch,
  url: string,
  init: {
    readonly headers: Record<string, string>;
    readonly body?: unknown;
  },
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, json };
}

function attributionDayForCycle(input: {
  readonly sinceDay: string;
  readonly untilDay: string;
  readonly billingCycleStart: string | null;
}): string {
  if (input.billingCycleStart !== null) {
    const cycleDay = input.billingCycleStart.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(cycleDay)) {
      if (cycleDay < input.sinceDay) return input.sinceDay;
      if (cycleDay > input.untilDay) return input.untilDay;
      return cycleDay;
    }
  }
  return input.untilDay;
}

async function readViaAdminApi(
  input: CursorCloudUsageInput,
  apiKey: string,
): Promise<CursorCloudUsageResult> {
  const startMs = Date.parse(`${input.sinceDay}T00:00:00Z`);
  const endMs = Date.parse(`${input.untilDay}T23:59:59.999Z`);
  const auth = `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;

  const filtered = await postJson(input.fetch, `${ADMIN_API_BASE}/teams/filtered-usage-events`, {
    headers: { authorization: auth },
    body: {
      startDate: Number.isFinite(startMs) ? startMs : input.sinceDay,
      endDate: Number.isFinite(endMs) ? endMs : input.untilDay,
    },
  });

  if (filtered.status === 401 || filtered.status === 403) {
    return {
      source: emptySource(
        input.hostId,
        "failed",
        "Cursor Admin API key was rejected. Check the key or use a machine with Cursor logged in.",
      ),
      records: [],
    };
  }

  if (!filtered.ok) {
    return {
      source: emptySource(
        input.hostId,
        "failed",
        `Cursor Admin API returned HTTP ${filtered.status}.`,
      ),
      records: [],
    };
  }

  const root =
    typeof filtered.json === "object" && filtered.json !== null
      ? (filtered.json as Record<string, unknown>)
      : {};
  const events = Array.isArray(root["usageEvents"])
    ? root["usageEvents"]
    : Array.isArray(root["events"])
      ? root["events"]
      : Array.isArray(filtered.json)
        ? filtered.json
        : [];

  const records = mapCursorFilteredEventsToRecords({
    events,
    timeZone: input.timeZone,
    sinceDay: input.sinceDay,
    untilDay: input.untilDay,
  });

  return {
    source: {
      ...emptySource(input.hostId, "ok", null),
      scannedFiles: 1,
      distinctSessions: new Set(records.map((record) => record.sessionId).filter(Boolean)).size,
      message: "Cursor usage from Enterprise Admin API.",
    },
    records,
  };
}

async function readViaDashboardRpc(
  input: CursorCloudUsageInput,
  accessToken: string,
): Promise<CursorCloudUsageResult> {
  const sub = decodeJwtSub(accessToken);
  const cookie =
    sub === null
      ? undefined
      : `WorkosCursorSessionToken=${encodeURIComponent(`${sub}::${accessToken}`)}`;

  const headers: Record<string, string> = {
    authorization: `Bearer ${accessToken}`,
    origin: "https://cursor.com",
    "user-agent": "Mozilla/5.0 (compatible; ModestoUsage/1.0)",
  };
  if (cookie !== undefined) headers["cookie"] = cookie;

  const period = await postJson(
    input.fetch,
    `${DASHBOARD_RPC_BASE}/aiserver.v1.DashboardService/GetCurrentPeriodUsage`,
    { headers, body: {} },
  );
  if (period.status === 401 || period.status === 403) {
    return {
      source: emptySource(
        input.hostId,
        "failed",
        "Cursor login expired. Sign in with Cursor on this machine, or add an Enterprise Admin API key in Settings.",
      ),
      records: [],
    };
  }

  const aggregated = await postJson(
    input.fetch,
    `${DASHBOARD_RPC_BASE}/aiserver.v1.DashboardService/GetAggregatedUsageEvents`,
    { headers, body: {} },
  );

  if (!aggregated.ok) {
    return {
      source: emptySource(
        input.hostId,
        "failed",
        `Cursor dashboard usage returned HTTP ${aggregated.status}.`,
      ),
      records: [],
    };
  }

  const periodRoot =
    typeof period.json === "object" && period.json !== null
      ? (period.json as Record<string, unknown>)
      : {};
  const billingCycleStart =
    typeof periodRoot["billingCycleStart"] === "string" ? periodRoot["billingCycleStart"] : null;

  const aggRoot =
    typeof aggregated.json === "object" && aggregated.json !== null
      ? (aggregated.json as Record<string, unknown>)
      : {};
  const aggregations = Array.isArray(aggRoot["aggregations"]) ? aggRoot["aggregations"] : [];

  const attributionDay = attributionDayForCycle({
    sinceDay: input.sinceDay,
    untilDay: input.untilDay,
    billingCycleStart,
  });

  const records = mapCursorAggregationsToRecords({
    aggregations,
    attributionDay,
    timeZone: input.timeZone,
    sessionId: sub ?? "cursor-cloud",
  });

  const cycleNote =
    billingCycleStart === null
      ? "Cursor cloud usage (current billing cycle aggregates)."
      : `Cursor cloud usage attributed to ${attributionDay} (billing-cycle aggregates; not a per-day breakdown).`;

  return {
    source: {
      ...emptySource(input.hostId, "ok", null),
      scannedFiles: 1,
      distinctSessions: records.length > 0 ? 1 : 0,
      message: cycleNote,
    },
    records,
  };
}

/**
 * Loads Cursor usage for the requested window. Never throws — network/auth
 * problems become a failed/missing source so the rest of the page still loads.
 */
export async function readCursorCloudUsage(
  input: CursorCloudUsageInput,
): Promise<CursorCloudUsageResult> {
  try {
    const adminKey = input.adminApiKey?.trim() ?? "";
    if (adminKey.length > 0) {
      return await readViaAdminApi(input, adminKey);
    }

    const token = await readLocalCursorAccessToken();
    if (token === null) {
      return {
        source: emptySource(
          input.hostId,
          "missing",
          "No Cursor login found on this machine. Sign in with Cursor, or add an Enterprise Admin API key in Settings → Cursor.",
        ),
        records: [],
      };
    }

    return await readViaDashboardRpc(input, token);
  } catch {
    return {
      source: emptySource(input.hostId, "failed", "Cursor cloud usage could not be read."),
      records: [],
    };
  }
}
