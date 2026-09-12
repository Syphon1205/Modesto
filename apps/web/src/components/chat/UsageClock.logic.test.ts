import { describe, expect, it } from "vite-plus/test";

import type { RateLimitsSnapshot } from "@modesto/shared/rateLimits";

import { usageClockIsHot, usageClockRemainingPercent } from "./UsageClock.logic";

function limits(
  windows: RateLimitsSnapshot["windows"],
  extras: Partial<RateLimitsSnapshot> = {},
): RateLimitsSnapshot {
  return {
    windows,
    planType: extras.planType ?? null,
    rateLimitReached: extras.rateLimitReached ?? false,
    updatedAt: extras.updatedAt ?? null,
  };
}

const fiveHour = (usedPercent: number) =>
  ({
    id: "five_hour" as const,
    label: "5h",
    usedPercent,
    resetsAtMs: null,
    windowDurationMins: 300,
    status: "allowed" as const,
  }) as const;

const weekly = (usedPercent: number) =>
  ({
    id: "weekly" as const,
    label: "Weekly",
    usedPercent,
    resetsAtMs: null,
    windowDurationMins: 10080,
    status: "allowed" as const,
  }) as const;

describe("usageClockRemainingPercent", () => {
  it("prefers the 5h window when present", () => {
    expect(usageClockRemainingPercent({ limits: limits([fiveHour(40), weekly(90)]) })).toBe(60);
  });

  it("falls back to the hottest rate-limit window, never context", () => {
    expect(usageClockRemainingPercent({ limits: limits([weekly(25)]) })).toBe(75);
    expect(usageClockRemainingPercent({ limits: null })).toBe(100);
  });
});

describe("usageClockIsHot", () => {
  it("flags a reached limit or a nearly empty remaining ring", () => {
    expect(
      usageClockIsHot({
        limits: limits([fiveHour(50)], { rateLimitReached: true }),
      }),
    ).toBe(true);
    expect(usageClockIsHot({ limits: limits([fiveHour(95)]) })).toBe(true);
    expect(usageClockIsHot({ limits: limits([fiveHour(20)]) })).toBe(false);
    expect(usageClockIsHot({ limits: null })).toBe(false);
  });
});
