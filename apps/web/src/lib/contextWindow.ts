import type {
  ModelSelection,
  OrchestrationThreadActivity,
  ThreadTokenUsageSnapshot,
} from "@modesto/contracts";
import { resolveModelSelectionContextWindowTokens } from "@modesto/shared/model";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

type NullableContextWindowUsage = {
  readonly [Key in keyof ThreadTokenUsageSnapshot]: undefined extends ThreadTokenUsageSnapshot[Key]
    ? Exclude<ThreadTokenUsageSnapshot[Key], undefined> | null
    : ThreadTokenUsageSnapshot[Key];
};

export type ContextWindowSnapshot = NullableContextWindowUsage & {
  readonly remainingTokens: number | null;
  readonly usedPercentage: number | null;
  readonly remainingPercentage: number | null;
  readonly updatedAt: string;
};

/** Map a provider driver kind to a user-facing display name. */
export function formatProviderDisplayName(provider: string | null | undefined): string {
  if (!provider) return "This agent";
  switch (provider) {
    case "claudeAgent":
    case "claude":
      return "Claude";
    case "codex":
      return "Codex";
    case "cursor":
      return "Cursor";
    case "grok":
      return "Grok";
    case "gemini":
      return "Gemini";
    case "meta":
    case "muse":
      return "Meta";
    case "opencode":
      return "OpenCode";
    case "githubCopilot":
      return "GitHub Copilot";
    case "customAcp":
      return "Custom ACP Agent";
    case "droid":
      return "Factory Droid";
    case "kimi":
      return "Kimi";
    case "qwen":
      return "Qwen";
    case "poolside":
      return "Poolside";
    case "devin":
      return "Devin";
    case "pi":
      return "Pi";
    default: {
      // Title-case unknown driver kinds so they read reasonably.
      const trimmed = provider.replace(/Agent$/i, "").trim();
      if (trimmed.length === 0) return provider;
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }
  }
}

export function deriveLatestContextWindowSnapshot(
  activities: ReadonlyArray<OrchestrationThreadActivity>,
): ContextWindowSnapshot | null {
  for (let index = activities.length - 1; index >= 0; index -= 1) {
    const activity = activities[index];
    if (!activity || activity.kind !== "context-window.updated") {
      continue;
    }

    const payload = asRecord(activity.payload);
    const usedTokens = asFiniteNumber(payload?.usedTokens);
    if (usedTokens === null || usedTokens < 0) {
      continue;
    }

    const maxTokens = asFiniteNumber(payload?.maxTokens);
    const usedPercentage =
      maxTokens !== null && maxTokens > 0 ? Math.min(100, (usedTokens / maxTokens) * 100) : null;
    const remainingTokens =
      maxTokens !== null ? Math.max(0, Math.round(maxTokens - usedTokens)) : null;
    const remainingPercentage = usedPercentage !== null ? Math.max(0, 100 - usedPercentage) : null;

    return {
      usedTokens,
      totalProcessedTokens: asFiniteNumber(payload?.totalProcessedTokens),
      maxTokens,
      remainingTokens,
      usedPercentage,
      remainingPercentage,
      inputTokens: asFiniteNumber(payload?.inputTokens),
      cachedInputTokens: asFiniteNumber(payload?.cachedInputTokens),
      outputTokens: asFiniteNumber(payload?.outputTokens),
      reasoningOutputTokens: asFiniteNumber(payload?.reasoningOutputTokens),
      lastUsedTokens: asFiniteNumber(payload?.lastUsedTokens),
      lastInputTokens: asFiniteNumber(payload?.lastInputTokens),
      lastCachedInputTokens: asFiniteNumber(payload?.lastCachedInputTokens),
      lastOutputTokens: asFiniteNumber(payload?.lastOutputTokens),
      lastReasoningOutputTokens: asFiniteNumber(payload?.lastReasoningOutputTokens),
      toolUses: asFiniteNumber(payload?.toolUses),
      durationMs: asFiniteNumber(payload?.durationMs),
      compactsAutomatically: asBoolean(payload?.compactsAutomatically) ?? false,
      updatedAt: activity.createdAt,
    };
  }

  return null;
}

function emptyContextWindowSnapshot(maxTokens: number | null): ContextWindowSnapshot {
  return {
    usedTokens: 0,
    totalProcessedTokens: null,
    maxTokens,
    remainingTokens: maxTokens,
    usedPercentage: maxTokens !== null && maxTokens > 0 ? 0 : null,
    remainingPercentage: maxTokens !== null && maxTokens > 0 ? 100 : null,
    inputTokens: null,
    cachedInputTokens: null,
    outputTokens: null,
    reasoningOutputTokens: null,
    lastUsedTokens: null,
    lastInputTokens: null,
    lastCachedInputTokens: null,
    lastOutputTokens: null,
    lastReasoningOutputTokens: null,
    toolUses: null,
    durationMs: null,
    compactsAutomatically: false,
    updatedAt: new Date(0).toISOString(),
  };
}

function withFallbackMaxTokens(
  snapshot: ContextWindowSnapshot,
  maxTokens: number,
): ContextWindowSnapshot {
  const usedPercentage =
    maxTokens > 0 ? Math.min(100, (snapshot.usedTokens / maxTokens) * 100) : null;
  return {
    ...snapshot,
    maxTokens,
    remainingTokens: Math.max(0, Math.round(maxTokens - snapshot.usedTokens)),
    usedPercentage,
    remainingPercentage: usedPercentage !== null ? Math.max(0, 100 - usedPercentage) : null,
  };
}

export function hasContextWindowModelChanged(input: {
  readonly selected: Pick<ModelSelection, "instanceId" | "model"> | null | undefined;
  readonly persisted: Pick<ModelSelection, "instanceId" | "model"> | null | undefined;
}): boolean {
  if (!input.selected || !input.persisted) {
    return false;
  }
  return (
    input.selected.instanceId !== input.persisted.instanceId ||
    input.selected.model !== input.persisted.model
  );
}

/**
 * Snapshot the compact ring and usage report should render.
 *
 * Always returns a value so the ring stays visible before the first usage
 * report. A chat that has not started a session is always empty — leftover
 * context-window rows from another thread must not fill a new composer.
 * Switching models on a started thread drops the previous model's usage
 * immediately; the next turn prepends a compacted transcript from
 * `@modesto/shared/contextCompact`.
 */
export function resolveVisibleContextWindowSnapshot(input: {
  readonly activities: ReadonlyArray<OrchestrationThreadActivity>;
  readonly selectedModelSelection: ModelSelection | null | undefined;
  readonly persistedModelSelection: ModelSelection | null | undefined;
  readonly hasStartedSession: boolean;
}): ContextWindowSnapshot {
  const fallbackMax = resolveModelSelectionContextWindowTokens(input.selectedModelSelection);
  if (!input.hasStartedSession) {
    return emptyContextWindowSnapshot(fallbackMax);
  }
  const resetForModelSwitch = hasContextWindowModelChanged({
    selected: input.selectedModelSelection,
    persisted: input.persistedModelSelection,
  });
  const raw = resetForModelSwitch ? null : deriveLatestContextWindowSnapshot(input.activities);
  if (!raw) {
    return emptyContextWindowSnapshot(fallbackMax);
  }
  if (raw.maxTokens !== null || fallbackMax === null) {
    return raw;
  }
  return withFallbackMaxTokens(raw, fallbackMax);
}

export function formatContextWindowTokens(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "0";
  }
  if (value < 1_000) {
    return `${Math.round(value)}`;
  }
  if (value < 10_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  if (value < 1_000_000) {
    return `${Math.round(value / 1_000)}k`;
  }
  return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}

export interface ContextWindowMeterDisplay {
  /** e.g. "42%", or `null` when the provider reports no window size. */
  readonly usedPercentageLabel: string | null;
  /** e.g. "128k". */
  readonly tokenUsageLabel: string;
  /** Percentage clamped to 0-100, safe to drive a ring or bar with. */
  readonly normalizedPercentage: number;
  /** Percentage when known, token count otherwise - whichever is meaningful. */
  readonly compactLabel: string;
  readonly ariaLabel: string;
}

function formatUsedPercentage(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  // Sub-10% gets a decimal: early in a long thread the integer would sit at
  // "0%" for a long time and read as "nothing is happening".
  return value < 10 ? `${value.toFixed(1).replace(/\.0$/, "")}%` : `${Math.round(value)}%`;
}

/**
 * Turns a raw usage snapshot into the numbers and labels a gauge renders.
 *
 * Shared by the compact meter and the full usage report so the two can never
 * disagree about what percentage the thread is at - they read the same
 * derivation rather than each rounding the snapshot their own way.
 */
export function deriveContextWindowMeterDisplay(
  usage: ContextWindowSnapshot,
): ContextWindowMeterDisplay {
  const usedPercentageLabel = formatUsedPercentage(usage.usedPercentage);
  const tokenUsageLabel = formatContextWindowTokens(usage.usedTokens);
  return {
    usedPercentageLabel,
    tokenUsageLabel,
    // Clamped because providers do overshoot their own reported window.
    // Unknown window size with real usage still fills the ring so the meter
    // does not disappear into an empty track.
    normalizedPercentage: Math.max(
      0,
      Math.min(100, usage.usedPercentage ?? (usage.usedTokens > 0 ? 100 : 0)),
    ),
    compactLabel: usedPercentageLabel ?? tokenUsageLabel,
    ariaLabel: usedPercentageLabel
      ? `Context window ${usedPercentageLabel} used`
      : `Context window ${tokenUsageLabel} tokens used`,
  };
}

/**
 * Total spend for a thread, or `null` when no provider reported any.
 *
 * Providers disagree on what they report: some send a running
 * `cumulativeCostUsd`, others send a per-turn `totalCostUsd`. Summing both
 * blindly would double-count, so a cumulative figure wins outright and only
 * per-turn deltas recorded *after* it are added on top.
 */
export function deriveCumulativeCostUsd(
  activities: ReadonlyArray<OrchestrationThreadActivity>,
): number | null {
  let turnDeltaTotal = 0;
  let latestCumulative: number | null = null;
  let foundTurnDelta = false;
  for (const activity of activities) {
    if (activity.kind !== "turn.completed") continue;
    const payload = asRecord(activity.payload);
    const cumulativeCost = asFiniteNumber(payload?.["cumulativeCostUsd"]);
    if (cumulativeCost !== null) {
      // A cumulative figure supersedes everything before it, so the running
      // delta total restarts from here.
      latestCumulative = cumulativeCost;
      turnDeltaTotal = 0;
      foundTurnDelta = false;
      continue;
    }
    const cost = asFiniteNumber(payload?.["totalCostUsd"]);
    if (cost === null) continue;
    turnDeltaTotal += cost;
    foundTurnDelta = true;
  }
  if (latestCumulative !== null) {
    return latestCumulative + turnDeltaTotal;
  }
  return foundTurnDelta ? turnDeltaTotal : null;
}

/**
 * Formats a USD amount, keeping enough decimals to stay non-zero.
 *
 * A fixed 2 decimals would render most single turns as "$0.00", which reads as
 * free rather than cheap; precision scales with how small the number is.
 */
export function formatCostUsd(value: number): string {
  if (value < 0.0001) return `$${value.toFixed(6)}`;
  if (value < 0.001) return `$${value.toFixed(5)}`;
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 0.1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(2)}`;
}
