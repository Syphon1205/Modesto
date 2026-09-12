import { GaugeIcon } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import type { RateLimitsSnapshot } from "@modesto/shared/rateLimits";

import { UsageClock } from "./UsageClock";

const limits: RateLimitsSnapshot = {
  planType: "pro",
  rateLimitReached: false,
  updatedAt: "2026-09-08T00:00:00.000Z",
  windows: [
    {
      id: "five_hour",
      label: "5h",
      usedPercent: 25,
      resetsAtMs: Date.now() + 90 * 60_000,
      windowDurationMins: 300,
      status: "allowed",
    },
  ],
};

describe("UsageClock", () => {
  it("renders account limits instead of thread context", () => {
    const markup = renderToStaticMarkup(<UsageClock modelDisplayName="Grok 4.6" limits={limits} />);

    expect(markup).toContain('aria-label="Usage for Grok 4.6, 75% remaining"');
    expect(markup).not.toContain("Context");
    expect(markup).toContain("lucide-gauge");
    expect(renderToStaticMarkup(<GaugeIcon className="size-4" />)).toContain("lucide-gauge");
  });

  it("does not treat a missing report as 100% remaining in the label", () => {
    const markup = renderToStaticMarkup(<UsageClock modelDisplayName="Grok 4.6" limits={null} />);
    expect(markup).toContain('aria-label="Usage for Grok 4.6"');
    expect(markup).not.toContain("100% remaining");
  });
});
