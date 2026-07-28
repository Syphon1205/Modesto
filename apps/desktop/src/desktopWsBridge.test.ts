import { describe, expect, it } from "vitest";

import { normalizeDesktopWsUrl, resolveDesktopWsUrlFromEnv } from "./desktopWsBridge";

describe("desktopWsBridge", () => {
  it("normalizes non-empty WebSocket URL strings", () => {
    expect(normalizeDesktopWsUrl(" ws://127.0.0.1:1234/?token=test ")).toBe(
      "ws://127.0.0.1:1234/?token=test",
    );
  });

  it("rejects empty or non-string values", () => {
    expect(normalizeDesktopWsUrl("   ")).toBeNull();
    expect(normalizeDesktopWsUrl(null)).toBeNull();
  });

  it("reads only the canonical Modesto desktop URL environment value", () => {
    expect(
      resolveDesktopWsUrlFromEnv({
        MODESTO_DESKTOP_WS_URL: "ws://127.0.0.1:6000/?token=modesto",
        UNRELATED_DESKTOP_WS_URL: "ws://127.0.0.1:5000/?token=ignored",
      }),
    ).toBe("ws://127.0.0.1:6000/?token=modesto");
    expect(
      resolveDesktopWsUrlFromEnv({
        UNRELATED_DESKTOP_WS_URL: "ws://127.0.0.1:5000/?token=ignored",
      }),
    ).toBeNull();
  });
});
