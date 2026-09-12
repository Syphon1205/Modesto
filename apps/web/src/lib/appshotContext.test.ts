import { describe, expect, it } from "vitest";

import {
  appendAppshotContextsToPrompt,
  buildAppshotContextBlock,
  extractTrailingAppshotContexts,
  formatAppshotContextLabel,
  normalizeAppshotContextSelection,
} from "./appshotContext";

describe("appshotContext", () => {
  it("normalizes and labels an appshot selection", () => {
    const normalized = normalizeAppshotContextSelection({
      appName: "  Xcode  ",
      windowTitle: " Project.xcodeproj ",
      accessibilityText: "  build failed  ",
      capturedAt: "2026-09-09T12:00:00.000Z",
    });
    expect(normalized).toEqual({
      appName: "Xcode",
      windowTitle: "Project.xcodeproj",
      accessibilityText: "build failed",
      capturedAt: "2026-09-09T12:00:00.000Z",
    });
    expect(formatAppshotContextLabel(normalized!)).toBe("Xcode — Project.xcodeproj");
  });

  it("rejects empty app names", () => {
    expect(
      normalizeAppshotContextSelection({
        appName: "   ",
        windowTitle: "Window",
        accessibilityText: "",
        capturedAt: "2026-09-09T12:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("round-trips append and extract", () => {
    const block = buildAppshotContextBlock([
      {
        appName: "Safari",
        windowTitle: "API docs",
        accessibilityText: "fetch(url)",
        capturedAt: "2026-09-09T12:00:00.000Z",
      },
    ]);
    expect(block.startsWith("<appshot_context>")).toBe(true);
    const prompt = appendAppshotContextsToPrompt("Fix this", [
      {
        appName: "Safari",
        windowTitle: "API docs",
        accessibilityText: "fetch(url)",
        capturedAt: "2026-09-09T12:00:00.000Z",
      },
    ]);
    expect(prompt.startsWith("Fix this")).toBe(true);
    const extracted = extractTrailingAppshotContexts(prompt);
    expect(extracted.promptText).toBe("Fix this");
    expect(extracted.contexts.length).toBe(1);
    expect(extracted.contexts[0]?.header).toContain("app: Safari");
  });
});
