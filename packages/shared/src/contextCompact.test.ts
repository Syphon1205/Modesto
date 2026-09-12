import { describe, expect, it } from "vite-plus/test";

import {
  buildCompactedContextPreamble,
  CONTEXT_COMPACT_TRANSCRIPT_CHAR_BUDGET,
  hasContextWindowModelChanged,
} from "./contextCompact.ts";

function message(input: { role: string; text: string }): { role: string; text: string } {
  return input;
}

describe("buildCompactedContextPreamble", () => {
  it("returns empty string when there is nothing to replay", () => {
    expect(
      buildCompactedContextPreamble({ messages: [], fromLabel: "Codex", toLabel: "Claude" }),
    ).toBe("");
  });

  it("skips system messages and blank text", () => {
    const messages = [
      message({ role: "system", text: "system prompt" }),
      message({ role: "user", text: "   " }),
    ];
    expect(buildCompactedContextPreamble({ messages, fromLabel: "Codex", toLabel: "Claude" })).toBe(
      "",
    );
  });

  it("replays user/assistant turns in order, labeled by speaker", () => {
    const messages = [
      message({ role: "user", text: "fix the bug" }),
      message({ role: "assistant", text: "done, see the diff" }),
    ];
    const preamble = buildCompactedContextPreamble({
      messages,
      fromLabel: "Codex",
      toLabel: "Claude",
    });
    expect(preamble).toContain("Handoff from Codex to Claude");
    const userIndex = preamble.indexOf("User: fix the bug");
    const assistantIndex = preamble.indexOf("Assistant: done, see the diff");
    expect(userIndex).toBeGreaterThan(-1);
    expect(assistantIndex).toBeGreaterThan(userIndex);
  });

  it("drops exactly one trailing user message matching the outgoing turn text", () => {
    const messages = [
      message({ role: "user", text: "first" }),
      message({ role: "assistant", text: "ok" }),
      message({ role: "user", text: "second" }),
    ];
    const preamble = buildCompactedContextPreamble({
      messages,
      fromLabel: "Codex",
      toLabel: "Claude",
      excludeTrailingText: "second",
    });
    expect(preamble).toContain("User: first");
    expect(preamble).not.toContain("User: second");
  });

  it("still replays an earlier occurrence of the same text as the excluded trailing one", () => {
    const messages = [
      message({ role: "user", text: "retry" }),
      message({ role: "assistant", text: "ok" }),
      message({ role: "user", text: "retry" }),
    ];
    const preamble = buildCompactedContextPreamble({
      messages,
      fromLabel: "Codex",
      toLabel: "Claude",
      excludeTrailingText: "retry",
    });
    expect(preamble.match(/User: retry/g)?.length).toBe(1);
  });

  it("truncates from the oldest end and says so, keeping the budget", () => {
    const longText = "x".repeat(1000);
    const messages = Array.from(
      { length: CONTEXT_COMPACT_TRANSCRIPT_CHAR_BUDGET / 500 + 5 },
      (_, i) =>
        message({
          role: i % 2 === 0 ? "user" : "assistant",
          text: `${longText}-${i}`,
        }),
    );
    const preamble = buildCompactedContextPreamble({
      messages,
      fromLabel: "Codex",
      toLabel: "Claude",
    });
    expect(preamble).toContain("Earlier messages were omitted");
    expect(preamble.length).toBeLessThan(CONTEXT_COMPACT_TRANSCRIPT_CHAR_BUDGET + 2000);
    expect(preamble).toContain(`-${messages.length - 1}`);
    expect(preamble).not.toContain("-0\n");
  });

  it("puts core context above the compacted transcript", () => {
    const preamble = buildCompactedContextPreamble({
      messages: [message({ role: "user", text: "keep this" })],
      fromLabel: "Codex",
      toLabel: "Claude",
      coreContext: "## Core context\nObjective: Keep the seam\nNext: Resume from the checkpoint",
    });
    const coreIndex = preamble.indexOf("## Core context");
    const transcriptIndex = preamble.indexOf("User: keep this");
    expect(coreIndex).toBeGreaterThan(-1);
    expect(transcriptIndex).toBeGreaterThan(coreIndex);
    expect(preamble).toContain("Core context for this handoff is below");
    expect(preamble).toContain("## Prior conversation");
  });

  it("can hand off with core context even when there is no transcript to replay", () => {
    const preamble = buildCompactedContextPreamble({
      messages: [],
      fromLabel: "Codex",
      toLabel: "Claude",
      coreContext: "## Core context\nObjective: Continue the restore",
    });
    expect(preamble).toContain("Handoff from Codex to Claude");
    expect(preamble).toContain("Objective: Continue the restore");
    expect(preamble).not.toContain("Prior conversation follows");
  });

  it("labels a model-switch compact replay without calling it a provider handoff", () => {
    const preamble = buildCompactedContextPreamble({
      messages: [message({ role: "user", text: "keep this" })],
      fromLabel: "gpt-5.4",
      toLabel: "claude-opus-4-8",
      reason: "model-switch",
    });
    expect(preamble).toContain("Context compacted after switching from gpt-5.4 to claude-opus-4-8");
    expect(preamble).toContain("User: keep this");
    expect(preamble).not.toContain("Handoff from");
  });
});

describe("hasContextWindowModelChanged", () => {
  it("is false until both selections exist", () => {
    expect(
      hasContextWindowModelChanged({
        selected: { instanceId: "codex", model: "gpt-5.4" },
        persisted: null,
      }),
    ).toBe(false);
  });

  it("detects a model or instance switch", () => {
    expect(
      hasContextWindowModelChanged({
        selected: { instanceId: "codex", model: "gpt-5.4" },
        persisted: { instanceId: "codex", model: "gpt-5.4" },
      }),
    ).toBe(false);
    expect(
      hasContextWindowModelChanged({
        selected: { instanceId: "codex", model: "gpt-5.5" },
        persisted: { instanceId: "codex", model: "gpt-5.4" },
      }),
    ).toBe(true);
    expect(
      hasContextWindowModelChanged({
        selected: { instanceId: "claude", model: "gpt-5.4" },
        persisted: { instanceId: "codex", model: "gpt-5.4" },
      }),
    ).toBe(true);
  });
});
