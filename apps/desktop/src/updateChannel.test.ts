import { describe, expect, it } from "vitest";

import {
  normalizeDesktopUpdateChannel,
  resolveBuildUpdateChannel,
  resolveUpdaterChannelName,
} from "./updateChannel";

describe("desktop update channels", () => {
  it("classifies stable and development build versions", () => {
    expect(resolveBuildUpdateChannel("0.1.1")).toBe("stable");
    expect(resolveBuildUpdateChannel("0.1.2-dev.4")).toBe("development");
    expect(resolveBuildUpdateChannel("0.1.2-beta.1")).toBe("development");
  });

  it("maps user-facing channels to dedicated updater manifests", () => {
    expect(resolveUpdaterChannelName("stable")).toBe("modesto");
    expect(resolveUpdaterChannelName("development")).toBe("modesto-dev");
  });

  it("falls back when persisted data is invalid", () => {
    expect(normalizeDesktopUpdateChannel("nightly", "stable")).toBe("stable");
  });
});
