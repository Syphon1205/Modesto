// FILE: composerAgentMenuItems.test.ts
// Purpose: Guards multi-agent picker item construction for Codex/Claude aliases.
// Layer: Unit test

import { describe, expect, it } from "vitest";

import { buildComposerAgentMenuItems } from "./composerAgentMenuItems";

describe("buildComposerAgentMenuItems", () => {
  it("returns static Codex aliases when no dynamic agents are provided", () => {
    const items = buildComposerAgentMenuItems({ provider: "codex" });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.type === "agent")).toBe(true);
    expect(items.some((item) => item.type === "agent" && item.alias === "5.3-codex")).toBe(true);
  });

  it("prefers dynamic agents when available", () => {
    const items = buildComposerAgentMenuItems({
      provider: "claudeAgent",
      dynamicAgents: [{ name: "explorer", displayName: "Explorer" }],
    });
    expect(items).toEqual([
      expect.objectContaining({
        type: "agent",
        alias: "explorer",
        label: "@explorer",
        description: "Explorer",
      }),
    ]);
  });
});
