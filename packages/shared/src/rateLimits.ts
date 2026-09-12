/**
 * Account rate-limit windows (Codex 5h/weekly, Claude five_hour/seven_day).
 *
 * Providers push `account.rate-limits.updated` with different shapes; this
 * module normalizes them into a small snapshot the usage clock can render.
 *
 * @module rateLimits
 */

export type RateLimitWindowId =
  | "five_hour"
  | "weekly"
  | "seven_day_opus"
  | "seven_day_sonnet"
  | "overage"
  | "unknown";

export type RateLimitWindowStatus = "allowed" | "allowed_warning" | "rejected";

export interface RateLimitWindowSnapshot {
  readonly id: RateLimitWindowId;
  readonly label: string;
  readonly usedPercent: number;
  readonly resetsAtMs: number | null;
  readonly windowDurationMins: number | null;
  readonly status: RateLimitWindowStatus | null;
}

export interface RateLimitsSnapshot {
  readonly windows: readonly RateLimitWindowSnapshot[];
  readonly planType: string | null;
  readonly rateLimitReached: boolean;
  readonly updatedAt: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function resetsAtMsFromUnknown(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Codex uses unix seconds; Claude may use seconds too. Values past year
    // 3000 in seconds would be absurd, so treat large numbers as ms.
    return value > 1e12 ? Math.trunc(value) : Math.trunc(value * 1000);
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function labelForDurationMins(mins: number | null, fallbackId: RateLimitWindowId): string {
  if (mins !== null) {
    if (mins <= 0) return fallbackId === "weekly" ? "Weekly" : "Limit";
    if (mins <= 60) return `${mins}m`;
    if (mins <= 360) {
      const hours = Math.round(mins / 60);
      return hours === 5 ? "5h" : `${hours}h`;
    }
    if (mins <= 60 * 24 * 2) {
      const hours = Math.round(mins / 60);
      return `${hours}h`;
    }
    const days = Math.round(mins / (60 * 24));
    return days === 7 ? "Weekly" : `${days}d`;
  }
  switch (fallbackId) {
    case "five_hour":
      return "5h";
    case "weekly":
      return "Weekly";
    case "seven_day_opus":
      return "Opus weekly";
    case "seven_day_sonnet":
      return "Sonnet weekly";
    case "overage":
      return "Overage";
    default:
      return "Limit";
  }
}

function windowIdFromDurationMins(
  mins: number | null,
  role: "primary" | "secondary",
): RateLimitWindowId {
  if (mins !== null) {
    if (mins > 0 && mins <= 360) return "five_hour";
    if (mins >= 60 * 24 * 6) return "weekly";
  }
  return role === "primary" ? "five_hour" : "weekly";
}

function windowIdFromClaudeType(value: string | null): RateLimitWindowId {
  switch (value) {
    case "five_hour":
      return "five_hour";
    case "seven_day":
      return "weekly";
    case "seven_day_opus":
      return "seven_day_opus";
    case "seven_day_sonnet":
      return "seven_day_sonnet";
    case "overage":
    case "seven_day_overage_included":
      return "overage";
    default:
      return "unknown";
  }
}

function statusFromUnknown(value: unknown): RateLimitWindowStatus | null {
  return value === "allowed" || value === "allowed_warning" || value === "rejected" ? value : null;
}

/**
 * Zero-length windows are disabled for the plan (not "unknown duration").
 * They still report usedPercent: 0, so they must be filtered out or they
 * render as a full unused quota.
 */
function isActiveWindow(window: RateLimitWindowSnapshot): boolean {
  return window.windowDurationMins === null || window.windowDurationMins > 0;
}

function makeWindow(input: {
  readonly id: RateLimitWindowId;
  readonly usedPercent: number;
  readonly resetsAtMs: number | null;
  readonly windowDurationMins: number | null;
  readonly status: RateLimitWindowStatus | null;
  readonly label?: string;
}): RateLimitWindowSnapshot | null {
  const window: RateLimitWindowSnapshot = {
    id: input.id,
    label: input.label ?? labelForDurationMins(input.windowDurationMins, input.id),
    usedPercent: clampPercent(input.usedPercent),
    resetsAtMs: input.resetsAtMs,
    windowDurationMins: input.windowDurationMins,
    status: input.status,
  };
  return isActiveWindow(window) ? window : null;
}

function parseCodexStyleWindow(
  value: unknown,
  role: "primary" | "secondary",
): RateLimitWindowSnapshot | null {
  const record = asRecord(value);
  if (record === null) return null;
  const usedPercent = asFiniteNumber(record["usedPercent"]);
  if (usedPercent === null) return null;
  const windowDurationMins = asFiniteNumber(record["windowDurationMins"]);
  const id = windowIdFromDurationMins(windowDurationMins, role);
  return makeWindow({
    id,
    usedPercent,
    resetsAtMs: resetsAtMsFromUnknown(record["resetsAt"]),
    windowDurationMins,
    status: null,
  });
}

/**
 * Parses one provider rate-limits payload into windows.
 *
 * Accepts:
 * - Codex `account/rateLimits/updated` snapshot (`primary`/`secondary`)
 * - Nested `{ rateLimits: { … } }` (our runtime event wrapper)
 * - Claude `rate_limit_event` / `rate_limit_info`
 */
export function parseRateLimitsPayload(payload: unknown): RateLimitsSnapshot | null {
  const root = asRecord(payload);
  if (root === null) return null;

  const rateLimitsRaw =
    asRecord(root["rateLimits"]) ??
    asRecord(root["rate_limit_info"]) ??
    (root["primary"] !== undefined ||
    root["secondary"] !== undefined ||
    root["rateLimitType"] !== undefined
      ? root
      : null);
  if (rateLimitsRaw === null) return null;

  // Codex runtime events wrap `{ rateLimits: notification }` where the
  // notification is already `{ rateLimits: snapshot }`. Unwrap once.
  const rateLimits =
    asRecord(rateLimitsRaw["rateLimits"]) &&
    rateLimitsRaw["primary"] === undefined &&
    rateLimitsRaw["secondary"] === undefined
      ? (asRecord(rateLimitsRaw["rateLimits"]) ?? rateLimitsRaw)
      : rateLimitsRaw;

  const windows: RateLimitWindowSnapshot[] = [];

  // Claude single-window push event.
  const claudeInfo = asRecord(rateLimits["rate_limit_info"]) ?? rateLimits;
  const claudeType = asString(claudeInfo["rateLimitType"]);
  const claudeUtilization = asFiniteNumber(claudeInfo["utilization"]);
  if (claudeType !== null && claudeUtilization !== null) {
    const window = makeWindow({
      id: windowIdFromClaudeType(claudeType),
      usedPercent: claudeUtilization,
      resetsAtMs: resetsAtMsFromUnknown(claudeInfo["resetsAt"]),
      windowDurationMins:
        claudeType === "five_hour" ? 300 : claudeType.startsWith("seven_day") ? 10080 : null,
      status: statusFromUnknown(claudeInfo["status"]),
    });
    if (window !== null) windows.push(window);
  }

  // Codex (and Claude usage API shaped) primary/secondary.
  const primary = parseCodexStyleWindow(rateLimits["primary"], "primary");
  if (primary !== null) windows.push(primary);
  const secondary = parseCodexStyleWindow(rateLimits["secondary"], "secondary");
  if (secondary !== null) windows.push(secondary);

  // Dedupe by id within one payload (prefer later / secondary when ids collide).
  const byId = new Map<RateLimitWindowId, RateLimitWindowSnapshot>();
  for (const window of windows) byId.set(window.id, window);

  if (byId.size === 0) return null;

  const ordered = [...byId.values()].toSorted((a, b) => {
    const rank = (id: RateLimitWindowId): number => {
      switch (id) {
        case "five_hour":
          return 0;
        case "weekly":
          return 1;
        case "seven_day_sonnet":
          return 2;
        case "seven_day_opus":
          return 3;
        case "overage":
          return 4;
        default:
          return 5;
      }
    };
    return rank(a.id) - rank(b.id);
  });

  const rateLimitReachedType = asString(rateLimits["rateLimitReachedType"]);
  const claudeRejected = statusFromUnknown(claudeInfo["status"]) === "rejected";

  return {
    windows: ordered,
    planType: asString(rateLimits["planType"]),
    rateLimitReached: claudeRejected || rateLimitReachedType !== null,
    updatedAt: null,
  };
}

/** Merge successive snapshots so Claude's single-window events accumulate. */
export function mergeRateLimitsSnapshots(
  snapshots: readonly RateLimitsSnapshot[],
): RateLimitsSnapshot | null {
  if (snapshots.length === 0) return null;
  const byId = new Map<RateLimitWindowId, RateLimitWindowSnapshot>();
  let planType: string | null = null;
  let rateLimitReached = false;
  let updatedAt: string | null = null;

  for (const snapshot of snapshots) {
    for (const window of snapshot.windows) byId.set(window.id, window);
    if (snapshot.planType !== null) planType = snapshot.planType;
    rateLimitReached = snapshot.rateLimitReached || rateLimitReached;
    if (snapshot.updatedAt !== null) updatedAt = snapshot.updatedAt;
  }

  if (byId.size === 0) return null;

  const windows = [...byId.values()].toSorted((a, b) => {
    const order = [
      "five_hour",
      "weekly",
      "seven_day_sonnet",
      "seven_day_opus",
      "overage",
      "unknown",
    ];
    return order.indexOf(a.id) - order.indexOf(b.id);
  });

  return { windows, planType, rateLimitReached, updatedAt };
}

export function formatRateLimitReset(
  resetsAtMs: number | null,
  nowMs: number = Date.now(),
): string | null {
  if (resetsAtMs === null) return null;
  const deltaMs = resetsAtMs - nowMs;
  if (deltaMs <= 0) return "soon";
  const totalMinutes = Math.round(deltaMs / 60_000);
  if (totalMinutes < 60) return `${Math.max(1, totalMinutes)}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 48) return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours === 0 ? `${days}d` : `${days}d ${remHours}h`;
}

export function formatRateLimitPercent(usedPercent: number): string {
  const remaining = Math.max(0, 100 - clampPercent(usedPercent));
  if (remaining < 10) {
    return `${remaining.toFixed(1).replace(/\.0$/, "")}% left`;
  }
  return `${Math.round(remaining)}% left`;
}

export const RATE_LIMITS_ACTIVITY_KIND = "account.rate-limits.updated" as const;

export function isRateLimitsActivity(activity: { readonly kind: string }): boolean {
  return activity.kind === RATE_LIMITS_ACTIVITY_KIND;
}

/**
 * Walk thread activities and build the merged rate-limits snapshot shown in
 * the usage clock.
 */
export function deriveRateLimitsSnapshot(
  activities: ReadonlyArray<{
    readonly kind: string;
    readonly createdAt?: string;
    readonly payload?: unknown;
  }>,
): RateLimitsSnapshot | null {
  const snapshots: RateLimitsSnapshot[] = [];
  for (const activity of activities) {
    if (!isRateLimitsActivity(activity)) continue;
    const parsed = parseRateLimitsPayload(activity.payload);
    if (parsed === null) continue;
    snapshots.push({
      ...parsed,
      updatedAt: typeof activity.createdAt === "string" ? activity.createdAt : parsed.updatedAt,
    });
  }
  return mergeRateLimitsSnapshots(snapshots);
}
