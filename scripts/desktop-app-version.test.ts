import { describe, expect, it } from "vitest";

import {
  resolveDesktopReleaseVersion,
  validateDesktopAppVersion,
} from "./lib/desktop-app-version";

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

  it("maps four-part Palo Alto patches onto a monotonic updater-safe SemVer lane", () => {
    expect(resolveDesktopReleaseVersion("0.1.7.1")).toEqual({
      releaseVersion: "0.1.7.1",
      appVersion: "0.1.8-patch.1",
      buildVersion: "0.1.7.1",
    });
    expect(resolveDesktopReleaseVersion("0.1.7.12").appVersion).toBe("0.1.8-patch.12");
    expect(() => resolveDesktopReleaseVersion("0.1.7.0")).toThrow(
      "Invalid desktop app version",
    );
  });
});
