import { describe, expect, it } from "vitest";

import { toPublicDesktopVersion } from "./releaseVersion.ts";

describe("toPublicDesktopVersion", () => {
  it("maps updater carrier versions back to public mini-patch versions", () => {
    expect(toPublicDesktopVersion("0.4.1-patch.1")).toBe("0.4.0.1");
    expect(toPublicDesktopVersion("0.4.1-patch.12")).toBe("0.4.0.12");
  });

  it("leaves ordinary and malformed versions unchanged", () => {
    expect(toPublicDesktopVersion("0.4.1")).toBe("0.4.1");
    expect(toPublicDesktopVersion("0.4.0-alpha.1")).toBe("0.4.0-alpha.1");
    expect(toPublicDesktopVersion("0.4.0-patch.1")).toBe("0.4.0-patch.1");
  });
});
