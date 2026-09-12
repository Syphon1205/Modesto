import { afterEach, describe, expect, it } from "vite-plus/test";

import type { RateLimitsSnapshot } from "@modesto/shared/rateLimits";

import {
  accountRateLimitsCacheKey,
  resetAccountRateLimitsCache,
  resolveVisibleRateLimits,
} from "./accountRateLimits";

afterEach(() => {
  resetAccountRateLimitsCache();
});

function snapshot(
  windows: RateLimitsSnapshot["windows"],
  extras: Partial<RateLimitsSnapshot> = {},
): RateLimitsSnapshot {
  return {
    windows,
    planType: extras.planType ?? "pro",
    rateLimitReached: extras.rateLimitReached ?? false,
    updatedAt: extras.updatedAt ?? "2026-09-08T00:00:00.000Z",
  };
}

const fiveHour = (usedPercent: number): RateLimitsSnapshot["windows"][number] => ({
  id: "five_hour",
  label: "5h",
  usedPercent,
  resetsAtMs: 1_700_000_000_000,
  windowDurationMins: 300,
  status: "allowed",
});

const weekly = (usedPercent: number): RateLimitsSnapshot["windows"][number] => ({
  id: "weekly",
  label: "Weekly",
  usedPercent,
  resetsAtMs: 1_700_500_000_000,
  windowDurationMins: 10080,
  status: "allowed",
});

describe("accountRateLimitsCacheKey", () => {
  it("scopes cached limits to the environment and provider instance", () => {
    expect(accountRateLimitsCacheKey("env-1", "claudeAgent")).toBe("env-1:claudeAgent");
    expect(accountRateLimitsCacheKey("env-1", null)).toBe("env-1");
    expect(accountRateLimitsCacheKey(null, "claudeAgent")).toBeNull();
  });
});

describe("resolveVisibleRateLimits", () => {
  it("keeps 5h / weekly limits when a new thread has not reported yet", () => {
    expect(
      resolveVisibleRateLimits({
        cacheKey: "env-1:claude",
        threadSnapshot: snapshot([fiveHour(42), weekly(11)]),
      })?.windows.map((window) => window.usedPercent),
    ).toEqual([42, 11]);

    const nextThread = resolveVisibleRateLimits({
      cacheKey: "env-1:claude",
      threadSnapshot: null,
    });
    expect(nextThread?.windows.map((window) => [window.id, window.usedPercent])).toEqual([
      ["five_hour", 42],
      ["weekly", 11],
    ]);
    expect(nextThread?.windows[0]?.resetsAtMs).toBe(1_700_000_000_000);
  });

  it("merges staggered Claude windows and does not leak across instances", () => {
    resolveVisibleRateLimits({
      cacheKey: "env-1:claude",
      threadSnapshot: snapshot([fiveHour(20)]),
    });
    const merged = resolveVisibleRateLimits({
      cacheKey: "env-1:claude",
      threadSnapshot: snapshot([weekly(8)]),
    });
    expect(merged?.windows.map((window) => window.id)).toEqual(["five_hour", "weekly"]);

    expect(
      resolveVisibleRateLimits({
        cacheKey: "env-1:codex",
        threadSnapshot: null,
      }),
    ).toBeNull();
  });
});
