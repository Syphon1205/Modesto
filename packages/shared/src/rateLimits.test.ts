import { describe, expect, it } from "vite-plus/test";

import {
  deriveRateLimitsSnapshot,
  formatRateLimitPercent,
  formatRateLimitReset,
  mergeRateLimitsSnapshots,
  parseRateLimitsPayload,
} from "./rateLimits.ts";

describe("parseRateLimitsPayload", () => {
  it("parses Codex primary/secondary windows with duration labels", () => {
    const snapshot = parseRateLimitsPayload({
      rateLimits: {
        planType: "pro",
        primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: 1_700_000_000 },
        secondary: { usedPercent: 18, windowDurationMins: 10080, resetsAt: 1_700_500_000 },
      },
    });

    expect(snapshot).toMatchObject({
      planType: "pro",
      rateLimitReached: false,
      windows: [
        { id: "five_hour", label: "5h", usedPercent: 25 },
        { id: "weekly", label: "Weekly", usedPercent: 18 },
      ],
    });
    expect(snapshot?.windows[0]?.resetsAtMs).toBe(1_700_000_000_000);
  });

  it("drops zero-duration disabled windows", () => {
    const snapshot = parseRateLimitsPayload({
      rateLimits: {
        primary: { usedPercent: 0, windowDurationMins: 0, resetsAt: null },
        secondary: { usedPercent: 12, windowDurationMins: 10080, resetsAt: 1_700_500_000 },
      },
    });
    expect(snapshot?.windows.map((window) => window.id)).toEqual(["weekly"]);
  });

  it("parses Claude rate_limit_event single windows", () => {
    const snapshot = parseRateLimitsPayload({
      type: "rate_limit_event",
      rate_limit_info: {
        status: "allowed_warning",
        rateLimitType: "five_hour",
        utilization: 91,
        resetsAt: 1_700_000_000,
      },
    });
    expect(snapshot).toMatchObject({
      rateLimitReached: false,
      windows: [{ id: "five_hour", label: "5h", usedPercent: 91, status: "allowed_warning" }],
    });
  });

  it("marks rejected Claude windows as reached", () => {
    const snapshot = parseRateLimitsPayload({
      rate_limit_info: {
        status: "rejected",
        rateLimitType: "seven_day",
        utilization: 100,
      },
    });
    expect(snapshot?.rateLimitReached).toBe(true);
    expect(snapshot?.windows[0]?.id).toBe("weekly");
  });
});

describe("mergeRateLimitsSnapshots", () => {
  it("accumulates Claude staggered windows", () => {
    const fiveHour = parseRateLimitsPayload({
      rate_limit_info: {
        status: "allowed",
        rateLimitType: "five_hour",
        utilization: 10,
      },
    });
    const weekly = parseRateLimitsPayload({
      rate_limit_info: {
        status: "allowed",
        rateLimitType: "seven_day",
        utilization: 40,
      },
    });
    const merged = mergeRateLimitsSnapshots([fiveHour!, weekly!]);
    expect(merged?.windows.map((window) => window.id)).toEqual(["five_hour", "weekly"]);
    expect(merged?.windows.map((window) => window.usedPercent)).toEqual([10, 40]);
  });
});

describe("deriveRateLimitsSnapshot", () => {
  it("reads account.rate-limits.updated activities", () => {
    const snapshot = deriveRateLimitsSnapshot([
      {
        kind: "account.rate-limits.updated",
        createdAt: "2026-05-01T00:00:00.000Z",
        payload: {
          rateLimits: {
            primary: { usedPercent: 5, windowDurationMins: 300, resetsAt: 1_700_000_000 },
            secondary: { usedPercent: 20, windowDurationMins: 10080, resetsAt: 1_700_500_000 },
            planType: "plus",
          },
        },
      },
    ]);
    expect(snapshot?.planType).toBe("plus");
    expect(snapshot?.windows).toHaveLength(2);
  });

  it("unwraps Codex double-wrapped rateLimits payloads from runtime events", () => {
    const snapshot = deriveRateLimitsSnapshot([
      {
        kind: "account.rate-limits.updated",
        payload: {
          rateLimits: {
            rateLimits: {
              planType: "plus",
              primary: { usedPercent: 8, windowDurationMins: 300, resetsAt: 1_700_000_000 },
              secondary: { usedPercent: 22, windowDurationMins: 10080, resetsAt: 1_700_500_000 },
            },
          },
        },
      },
    ]);
    expect(snapshot?.planType).toBe("plus");
    expect(snapshot?.windows.map((window) => window.label)).toEqual(["5h", "Weekly"]);
  });
});

describe("format helpers", () => {
  it("formats remaining percent and reset countdown", () => {
    expect(formatRateLimitPercent(25)).toBe("75% left");
    expect(formatRateLimitReset(Date.now() + 90 * 60_000, Date.now())).toBe("1h 30m");
  });
});
