import { describe, expect, it } from "vite-plus/test";

import { shouldAllowMediaPermissionRequest } from "./DesktopMediaPermissions.ts";

describe("shouldAllowMediaPermissionRequest", () => {
  it("allows an explicit audio request", () => {
    expect(shouldAllowMediaPermissionRequest({ mediaTypes: ["audio"] })).toBe(true);
    expect(shouldAllowMediaPermissionRequest({ mediaTypes: ["audio", "video"] })).toBe(true);
  });

  it("allows a request that omits mediaTypes", () => {
    // Electron omits it for some audio-only requests. Denying would suppress
    // the macOS prompt entirely and the user could never grant access.
    expect(shouldAllowMediaPermissionRequest({})).toBe(true);
    expect(shouldAllowMediaPermissionRequest({ mediaTypes: [] })).toBe(true);
    expect(shouldAllowMediaPermissionRequest(undefined)).toBe(true);
    expect(shouldAllowMediaPermissionRequest(null)).toBe(true);
  });

  it("denies a video-only request", () => {
    expect(shouldAllowMediaPermissionRequest({ mediaTypes: ["video"] })).toBe(false);
  });

  it("treats a non-array mediaTypes as unspecified", () => {
    expect(shouldAllowMediaPermissionRequest({ mediaTypes: "audio" })).toBe(true);
  });
});
