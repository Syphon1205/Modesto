import { describe, expect, it } from "vitest";
import type { OrchestrationMessage } from "@modesto/contracts";
import {
  buildProviderHandoffPreamble,
  PROVIDER_HANDOFF_TRANSCRIPT_CHAR_BUDGET,
} from "./providerHandoffContext.ts";

function message(input: {
  role: OrchestrationMessage["role"];
  text: string;
  id?: string;
}): OrchestrationMessage {
  return {
    id: (input.id ?? `msg-${input.text.slice(0, 8)}`) as OrchestrationMessage["id"],
    role: input.role,
    text: input.text,
    turnId: null,
    streaming: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("buildProviderHandoffPreamble", () => {
  it("returns empty string when there is nothing to replay", () => {
    expect(
      buildProviderHandoffPreamble({ messages: [], fromLabel: "Codex", toLabel: "Claude" }),
    ).toBe("");
  });

  it("skips system messages and blank text", () => {
    const messages = [
      message({ role: "system", text: "system prompt" }),
      message({ role: "user", text: "   " }),
    ];
    expect(buildProviderHandoffPreamble({ messages, fromLabel: "Codex", toLabel: "Claude" })).toBe(
      "",
    );
  });

  it("replays user/assistant turns in order, labeled by speaker", () => {
    const messages = [
      message({ role: "user", text: "fix the bug", id: "m1" }),
      message({ role: "assistant", text: "done, see the diff", id: "m2" }),
    ];
    const preamble = buildProviderHandoffPreamble({
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
      message({ role: "user", text: "first", id: "m1" }),
      message({ role: "assistant", text: "ok", id: "m2" }),
      message({ role: "user", text: "second", id: "m3" }),
    ];
    const preamble = buildProviderHandoffPreamble({
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
      message({ role: "user", text: "retry", id: "m1" }),
      message({ role: "assistant", text: "ok", id: "m2" }),
      message({ role: "user", text: "retry", id: "m3" }),
    ];
    const preamble = buildProviderHandoffPreamble({
      messages,
      fromLabel: "Codex",
      toLabel: "Claude",
      excludeTrailingText: "retry",
    });
    // Only the trailing occurrence is dropped - the earlier "retry" is real history.
    expect(preamble.match(/User: retry/g)?.length).toBe(1);
  });

  it("truncates from the oldest end and says so, keeping the budget", () => {
    const longText = "x".repeat(1000);
    const messages = Array.from(
      { length: PROVIDER_HANDOFF_TRANSCRIPT_CHAR_BUDGET / 500 + 5 },
      (_, i) =>
        message({
          role: i % 2 === 0 ? "user" : "assistant",
          text: `${longText}-${i}`,
          id: `m${i}`,
        }),
    );
    const preamble = buildProviderHandoffPreamble({
      messages,
      fromLabel: "Codex",
      toLabel: "Claude",
    });
    expect(preamble).toContain("Earlier messages were omitted");
    expect(preamble.length).toBeLessThan(PROVIDER_HANDOFF_TRANSCRIPT_CHAR_BUDGET + 2000);
    // The most recent message must survive truncation, not the oldest.
    expect(preamble).toContain(`-${messages.length - 1}`);
    expect(preamble).not.toContain("-0\n");
  });
});
