import { describe, expect, it } from "vite-plus/test";
import {
  EventId,
  type OrchestrationThreadActivity,
  ProviderInstanceId,
  TurnId,
} from "@modesto/contracts";
import { createModelSelection } from "@modesto/shared/model";

import {
  deriveContextWindowMeterDisplay,
  deriveCumulativeCostUsd,
  deriveLatestContextWindowSnapshot,
  formatContextWindowTokens,
  formatCostUsd,
  resolveVisibleContextWindowSnapshot,
  type ContextWindowSnapshot,
} from "./contextWindow";

function makeActivity(id: string, kind: string, payload: unknown): OrchestrationThreadActivity {
  return {
    id: EventId.make(id),
    tone: "info",
    kind,
    summary: kind,
    payload,
    turnId: TurnId.make("turn-1"),
    createdAt: "2026-03-23T00:00:00.000Z",
  };
}

describe("contextWindow", () => {
  it("derives the latest valid context window snapshot", () => {
    const snapshot = deriveLatestContextWindowSnapshot([
      makeActivity("activity-1", "context-window.updated", {
        usedTokens: 1000,
      }),
      makeActivity("activity-2", "tool.started", {}),
      makeActivity("activity-3", "context-window.updated", {
        usedTokens: 14_000,
        maxTokens: 258_000,
        compactsAutomatically: true,
      }),
    ]);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.usedTokens).toBe(14_000);
    expect(snapshot?.totalProcessedTokens).toBeNull();
    expect(snapshot?.maxTokens).toBe(258_000);
    expect(snapshot?.compactsAutomatically).toBe(true);
  });

  it("ignores malformed payloads", () => {
    const snapshot = deriveLatestContextWindowSnapshot([
      makeActivity("activity-1", "context-window.updated", {}),
    ]);

    expect(snapshot).toBeNull();
  });

  it("keeps valid zero-usage snapshots", () => {
    const snapshot = deriveLatestContextWindowSnapshot([
      makeActivity("activity-1", "context-window.updated", {
        usedTokens: 0,
        maxTokens: 100_000,
      }),
    ]);

    expect(snapshot).toMatchObject({
      usedTokens: 0,
      maxTokens: 100_000,
      remainingTokens: 100_000,
      usedPercentage: 0,
      remainingPercentage: 100,
    });
  });

  it("formats compact token counts", () => {
    expect(formatContextWindowTokens(999)).toBe("999");
    expect(formatContextWindowTokens(1400)).toBe("1.4k");
    expect(formatContextWindowTokens(14_000)).toBe("14k");
    expect(formatContextWindowTokens(258_000)).toBe("258k");
  });

  it("includes total processed tokens when available", () => {
    const snapshot = deriveLatestContextWindowSnapshot([
      makeActivity("activity-1", "context-window.updated", {
        usedTokens: 81_659,
        totalProcessedTokens: 748_126,
        maxTokens: 258_400,
        lastUsedTokens: 81_659,
      }),
    ]);

    expect(snapshot?.usedTokens).toBe(81_659);
    expect(snapshot?.totalProcessedTokens).toBe(748_126);
  });
});

function snapshot(overrides: Partial<ContextWindowSnapshot>): ContextWindowSnapshot {
  return {
    usedTokens: 0,
    totalProcessedTokens: null,
    maxTokens: null,
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
    remainingTokens: null,
    usedPercentage: null,
    remainingPercentage: null,
    updatedAt: "2026-03-23T00:00:00.000Z",
    ...overrides,
  } as ContextWindowSnapshot;
}

describe("deriveContextWindowMeterDisplay", () => {
  it("labels a known percentage", () => {
    const display = deriveContextWindowMeterDisplay(
      snapshot({ usedTokens: 42_000, maxTokens: 100_000, usedPercentage: 42 }),
    );

    expect(display.compactLabel).toBe("42%");
    expect(display.normalizedPercentage).toBe(42);
    expect(display.ariaLabel).toBe("Context window 42% used");
  });

  it("keeps a decimal below 10% so early usage does not read as zero", () => {
    expect(deriveContextWindowMeterDisplay(snapshot({ usedPercentage: 2.4 })).compactLabel).toBe(
      "2.4%",
    );
    expect(deriveContextWindowMeterDisplay(snapshot({ usedPercentage: 3 })).compactLabel).toBe(
      "3%",
    );
  });

  it("falls back to a token count when the window size is unknown", () => {
    const display = deriveContextWindowMeterDisplay(snapshot({ usedTokens: 14_000 }));

    expect(display.usedPercentageLabel).toBeNull();
    expect(display.compactLabel).toBe("14k");
    expect(display.ariaLabel).toBe("Context window 14k tokens used");
    expect(display.normalizedPercentage).toBe(100);
  });

  it("clamps a percentage that overshoots the reported window", () => {
    // Providers do report more used than their own stated maximum.
    expect(
      deriveContextWindowMeterDisplay(snapshot({ usedPercentage: 140 })).normalizedPercentage,
    ).toBe(100);
    expect(
      deriveContextWindowMeterDisplay(snapshot({ usedPercentage: -5 })).normalizedPercentage,
    ).toBe(0);
  });
});

describe("resolveVisibleContextWindowSnapshot", () => {
  const persisted = createModelSelection(
    ProviderInstanceId.make("claudeAgent"),
    "claude-opus-4-8",
    [{ id: "contextWindow", value: "1m" }],
  );
  const selected200k = createModelSelection(
    ProviderInstanceId.make("claudeAgent"),
    "claude-sonnet-4-6",
    [{ id: "contextWindow", value: "200k" }],
  );

  it("always returns a ring snapshot, filling max tokens from the selected model", () => {
    const snapshot = resolveVisibleContextWindowSnapshot({
      activities: [
        makeActivity("activity-1", "context-window.updated", {
          usedTokens: 148_000,
        }),
      ],
      selectedModelSelection: persisted,
      persistedModelSelection: persisted,
      hasStartedSession: true,
    });

    expect(snapshot.usedTokens).toBe(148_000);
    expect(snapshot.maxTokens).toBe(1_000_000);
    expect(snapshot.usedPercentage).toBeCloseTo(14.8, 5);
  });

  it("shows an empty ring before the first usage report", () => {
    const snapshot = resolveVisibleContextWindowSnapshot({
      activities: [],
      selectedModelSelection: persisted,
      persistedModelSelection: persisted,
      hasStartedSession: false,
    });

    expect(snapshot.usedTokens).toBe(0);
    expect(snapshot.maxTokens).toBe(1_000_000);
    expect(snapshot.usedPercentage).toBe(0);
  });

  it("does not carry another chat's fill onto a thread that has not started", () => {
    const snapshot = resolveVisibleContextWindowSnapshot({
      activities: [
        makeActivity("activity-1", "context-window.updated", {
          usedTokens: 176_000,
          maxTokens: 200_000,
        }),
      ],
      selectedModelSelection: selected200k,
      persistedModelSelection: selected200k,
      hasStartedSession: false,
    });

    expect(snapshot.usedTokens).toBe(0);
    expect(snapshot.maxTokens).toBe(200_000);
    expect(snapshot.usedPercentage).toBe(0);
  });

  it("resets usage when the selected model changes on a started thread", () => {
    const snapshot = resolveVisibleContextWindowSnapshot({
      activities: [
        makeActivity("activity-1", "context-window.updated", {
          usedTokens: 148_000,
          maxTokens: 1_000_000,
        }),
      ],
      selectedModelSelection: selected200k,
      persistedModelSelection: persisted,
      hasStartedSession: true,
    });

    expect(snapshot.usedTokens).toBe(0);
    expect(snapshot.maxTokens).toBe(200_000);
    expect(snapshot.usedPercentage).toBe(0);
  });
});

describe("deriveCumulativeCostUsd", () => {
  it("returns null when no provider reported cost", () => {
    expect(deriveCumulativeCostUsd([])).toBeNull();
    expect(
      deriveCumulativeCostUsd([makeActivity("a", "turn.completed", { usedTokens: 1 })]),
    ).toBeNull();
  });

  it("sums per-turn costs", () => {
    expect(
      deriveCumulativeCostUsd([
        makeActivity("a", "turn.completed", { totalCostUsd: 0.01 }),
        makeActivity("b", "turn.completed", { totalCostUsd: 0.02 }),
      ]),
    ).toBeCloseTo(0.03, 10);
  });

  it("prefers a cumulative figure over the per-turn deltas it already covers", () => {
    // Adding both would double-count the turns the cumulative total includes.
    expect(
      deriveCumulativeCostUsd([
        makeActivity("a", "turn.completed", { totalCostUsd: 0.01 }),
        makeActivity("b", "turn.completed", { cumulativeCostUsd: 0.5 }),
      ]),
    ).toBe(0.5);
  });

  it("adds per-turn deltas reported after the latest cumulative figure", () => {
    expect(
      deriveCumulativeCostUsd([
        makeActivity("a", "turn.completed", { cumulativeCostUsd: 0.5 }),
        makeActivity("b", "turn.completed", { totalCostUsd: 0.25 }),
      ]),
    ).toBeCloseTo(0.75, 10);
  });

  it("ignores activities that are not completed turns", () => {
    expect(
      deriveCumulativeCostUsd([makeActivity("a", "tool.started", { totalCostUsd: 9 })]),
    ).toBeNull();
  });
});

describe("formatCostUsd", () => {
  it("keeps small amounts from rounding away to $0.00", () => {
    expect(formatCostUsd(0.00002)).toBe("$0.000020");
    expect(formatCostUsd(0.0005)).toBe("$0.00050");
    expect(formatCostUsd(0.004)).toBe("$0.0040");
    expect(formatCostUsd(0.05)).toBe("$0.050");
  });

  it("uses two decimals once the amount is meaningful", () => {
    expect(formatCostUsd(1.239)).toBe("$1.24");
  });
});
