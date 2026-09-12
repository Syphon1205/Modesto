import { describe, expect, it } from "vitest";

import { parseAppshotHelperLine } from "./appshotProtocol.ts";

describe("parseAppshotHelperLine", () => {
  it("decodes a successful appshot event", () => {
    const event = parseAppshotHelperLine(
      JSON.stringify({
        type: "appshot",
        appName: "Safari",
        windowTitle: "Docs",
        accessibilityText: "Hello",
        pngBase64: "abc",
        capturedAt: "2026-09-09T12:00:00.000Z",
      }),
    );
    expect(event).toEqual({
      type: "appshot",
      appName: "Safari",
      windowTitle: "Docs",
      accessibilityText: "Hello",
      pngBase64: "abc",
      capturedAt: "2026-09-09T12:00:00.000Z",
    });
  });

  it("decodes an error event", () => {
    const event = parseAppshotHelperLine(
      JSON.stringify({ type: "error", message: "No frontmost window found" }),
    );
    expect(event).toEqual({ type: "error", message: "No frontmost window found" });
  });

  it("returns null for invalid JSON", () => {
    expect(parseAppshotHelperLine("{")).toBeNull();
    expect(parseAppshotHelperLine("")).toBeNull();
  });
});
