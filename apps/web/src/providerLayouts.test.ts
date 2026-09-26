import { describe, expect, it } from "vitest";

import {
  codexDraftHeadline,
  compactAgeLabel,
  providerLayoutOf,
  sidebarRecencyBucket,
} from "./providerLayouts";

describe("providerLayoutOf", () => {
  it("recognizes only the three provider shells", () => {
    expect(providerLayoutOf("claude")).toBe("claude");
    expect(providerLayoutOf("codex")).toBe("codex");
    expect(providerLayoutOf("cursor")).toBe("cursor");
    expect(providerLayoutOf("github")).toBeNull();
    expect(providerLayoutOf("opencode")).toBeNull();
    expect(providerLayoutOf("classic")).toBeNull();
  });
});

describe("sidebarRecencyBucket", () => {
  const now = new Date(2026, 8, 22, 15, 0, 0);

  it("buckets by local calendar day", () => {
    expect(sidebarRecencyBucket(new Date(2026, 8, 22, 0, 5).toISOString(), now)).toBe("Today");
    expect(sidebarRecencyBucket(new Date(2026, 8, 21, 23, 59).toISOString(), now)).toBe(
      "Yesterday",
    );
    expect(sidebarRecencyBucket(new Date(2026, 8, 20, 12, 0).toISOString(), now)).toBe("Older");
  });

  it("treats unparseable timestamps as old", () => {
    expect(sidebarRecencyBucket("not a date", now)).toBe("Older");
  });
});

describe("compactAgeLabel", () => {
  const now = new Date("2026-09-22T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it("matches the Codex sidebar's short ages", () => {
    expect(compactAgeLabel(ago(20_000), now)).toBe("now");
    expect(compactAgeLabel(ago(5 * 60_000), now)).toBe("5m");
    expect(compactAgeLabel(ago(3 * 3_600_000), now)).toBe("3h");
    expect(compactAgeLabel(ago(2 * 86_400_000), now)).toBe("2d");
    expect(compactAgeLabel(ago(8 * 86_400_000), now)).toBe("1w");
    expect(compactAgeLabel(ago(45 * 86_400_000), now)).toBe("1mo");
    expect(compactAgeLabel(ago(400 * 86_400_000), now)).toBe("1y");
  });

  it("returns an empty label for invalid input", () => {
    expect(compactAgeLabel("nope", now)).toBe("");
  });
});

describe("codexDraftHeadline", () => {
  it("names the project when there is one", () => {
    expect(codexDraftHeadline("fitness-tracker")).toBe("What should we build in fitness-tracker?");
    expect(codexDraftHeadline(null)).toBe("What should we build?");
  });
});
