import { describe, expect, it } from "vitest";

import {
  ONBOARDING_COMPLETE_STORAGE_KEY,
  hasCompletedOnboarding,
  markOnboardingComplete,
  resolveOnboardingVisibility,
} from "./onboardingState";

describe("onboarding state", () => {
  it("waits for workspace hydration before deciding", () => {
    expect(
      resolveOnboardingVisibility({
        completed: false,
        hydrated: false,
        projectCount: 0,
        threadCount: 0,
      }),
    ).toBe("pending");
  });

  it("shows only for a genuinely empty workspace", () => {
    expect(
      resolveOnboardingVisibility({
        completed: false,
        hydrated: true,
        projectCount: 0,
        threadCount: 0,
      }),
    ).toBe("show");
    expect(
      resolveOnboardingVisibility({
        completed: false,
        hydrated: true,
        projectCount: 1,
        threadCount: 0,
      }),
    ).toBe("skip-existing-workspace");
  });

  it("persists completion defensively", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(hasCompletedOnboarding(storage)).toBe(false);
    markOnboardingComplete(storage);
    expect(values.get(ONBOARDING_COMPLETE_STORAGE_KEY)).toBe("1");
    expect(hasCompletedOnboarding(storage)).toBe(true);
  });
});
