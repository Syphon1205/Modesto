import { describe, expect, it } from "@effect/vitest";

import {
  mapCursorAggregationsToRecords,
  mapCursorFilteredEventsToRecords,
} from "./cursorCloudUsage.ts";

describe("mapCursorAggregationsToRecords", () => {
  it("maps model aggregations onto the attribution day with provider-reported cost", () => {
    const records = mapCursorAggregationsToRecords({
      aggregations: [
        {
          modelIntent: "claude-4.5-sonnet",
          inputTokens: 1000,
          outputTokens: 200,
          cacheReadTokens: 100,
          cacheWriteTokens: 50,
          totalCents: 42,
        },
      ],
      attributionDay: "2026-08-15",
      timeZone: "UTC",
      sessionId: "user_1",
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      provider: "cursor",
      model: "claude-4.5-sonnet",
      sessionId: "user_1",
      reportedCostUsd: 0.42,
      totals: {
        uncachedInputTokens: 850,
        cachedInputTokens: 100,
        cacheCreationTokens: 50,
        outputTokens: 200,
        reasoningTokens: 0,
      },
    });
    expect(new Date(records[0]!.timestampMs).toISOString().startsWith("2026-08-15")).toBe(true);
  });

  it("skips rows without a model or tokens", () => {
    expect(
      mapCursorAggregationsToRecords({
        aggregations: [{ modelIntent: "", inputTokens: 10 }, { modelIntent: "x" }],
        attributionDay: "2026-08-15",
        timeZone: "UTC",
        sessionId: "user_1",
      }),
    ).toEqual([]);
  });
});

describe("mapCursorFilteredEventsToRecords", () => {
  it("keeps only events inside the day window", () => {
    const records = mapCursorFilteredEventsToRecords({
      events: [
        {
          id: "in",
          timestamp: "2026-08-10T12:00:00.000Z",
          model: "gpt-5",
          tokenUsage: { inputTokens: 10, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 },
          chargedCents: 5,
        },
        {
          id: "out",
          timestamp: "2026-07-01T12:00:00.000Z",
          model: "gpt-5",
          tokenUsage: { inputTokens: 10, outputTokens: 2 },
          chargedCents: 5,
        },
      ],
      timeZone: "UTC",
      sinceDay: "2026-08-01",
      untilDay: "2026-08-31",
    });

    expect(records).toHaveLength(1);
    expect(records[0]?.dedupeKey).toBe("cursor-event:in");
    expect(records[0]?.reportedCostUsd).toBe(0.05);
  });
});
