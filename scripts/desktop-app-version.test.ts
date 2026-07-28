import { describe, expect, it } from "vitest";

import { validateDesktopAppVersion } from "./lib/desktop-app-version";

describe("desktop app version", () => {
  it.each([
    "0.1.0",
    "0.1.1-dev.20260717.50",
    "1.0.0-rc.1",
    "1.0.0-beta.fix1",
    "1.0.0+build.20260717",
  ])("accepts strict SemVer %s", (version) => {
    expect(validateDesktopAppVersion(version)).toBe(version);
  });

  it.each([
    "0.1.1-dev.20260717.0050",
    "01.1.0",
    "1.01.0",
    "1.0.01",
    "v1.0.0",
    "1.0",
    "1.0.0-dev..1",
  ])("rejects a version electron-updater cannot safely consume: %s", (version) => {
    expect(() => validateDesktopAppVersion(version)).toThrow("Invalid desktop app version");
  });
});
