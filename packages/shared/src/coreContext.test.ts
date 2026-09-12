import { describe, expect, it } from "vite-plus/test";

import {
  buildCoreContext,
  coreContextActivitySummary,
  coreContextReasonFromHandoffTurnId,
  formatCoreContextBlock,
  hasActionableCoreContext,
  hasReplayableCoreContextMessages,
  shouldCarryCoreContext,
} from "./coreContext.ts";

describe("buildCoreContext", () => {
  it("uses the thread title and latest plan fields for a handoff seam", () => {
    const context = buildCoreContext({
      title: "Fix resume after provider switch",
      messages: [
        { role: "user", text: "Keep native resume dropped across providers." },
        {
          role: "assistant",
          text: "Wired the restart path.\n\nDecision: drop resumeCursor on handoff.",
        },
      ],
      proposedPlans: [
        {
          implementedAt: null,
          planMarkdown: [
            "## Next",
            "Update resumeProviderSession()",
            "",
            "Incomplete: Reconnect path still uses legacy auth",
            "Decision: Keep native resume dropped across providers",
          ].join("\n"),
        },
      ],
      latestCheckpoint: {
        checkpointTurnCount: 4,
        checkpointRef: "refs/t3/checkpoints/abc/turn/4",
        files: [{ path: "apps/server/src/foo.ts", additions: 12, deletions: 3 }],
      },
      reason: "handoff",
    });

    expect(context.objective).toBe("Fix resume after provider switch");
    expect(context.decisions).toEqual([
      "Keep native resume dropped across providers",
      "drop resumeCursor on handoff.",
    ]);
    expect(context.status).toContain("Wired the restart path.");
    expect(context.incomplete).toBe("Reconnect path still uses legacy auth");
    expect(context.nextStep).toBe("Update resumeProviderSession()");
    expect(context.checks).toBe("Not run");
    expect(context.checkpointTurnCount).toBe(4);
  });

  it("falls back to the first user message when the title is the default", () => {
    const context = buildCoreContext({
      title: "New thread",
      messages: [{ role: "user", text: "Fix the flaky checkpoint restore." }],
      reason: "model-switch",
    });
    expect(context.objective).toBe("Fix the flaky checkpoint restore.");
    expect(context.status).toContain("Model switch seam captured");
  });

  it("prefers an unimplemented plan over an older implemented one", () => {
    const context = buildCoreContext({
      title: "Ship handoff",
      messages: [{ role: "user", text: "continue" }],
      proposedPlans: [
        {
          implementedAt: "2026-01-01T00:00:00.000Z",
          planMarkdown: "Next: stale step\nIncomplete: stale gap",
        },
        {
          implementedAt: null,
          planMarkdown: "Next: current step\nIncomplete: current gap",
        },
      ],
      reason: "plan",
    });
    expect(context.nextStep).toBe("current step");
    expect(context.incomplete).toBe("current gap");
  });

  it("records passing checks when the transcript says tests passed", () => {
    const context = buildCoreContext({
      title: "Checks",
      messages: [{ role: "assistant", text: "All tests passed after the restore." }],
      reason: "turn",
    });
    expect(context.checks).toBe("Passed");
  });
});

describe("formatCoreContextBlock", () => {
  it("renders the handoff block the next model can act on", () => {
    const block = formatCoreContextBlock(
      buildCoreContext({
        title: "Fix resume after provider switch",
        messages: [{ role: "assistant", text: "Ready to hand off." }],
        proposedPlans: [
          {
            implementedAt: null,
            planMarkdown:
              "Incomplete: Reconnect path still uses legacy auth\nNext: Update resumeProviderSession()",
          },
        ],
        latestCheckpoint: {
          checkpointTurnCount: 184,
          checkpointRef: "refs/t3/checkpoints/abc/turn/184",
          files: [
            { path: "a.ts", additions: 1, deletions: 0 },
            { path: "b.ts", additions: 2, deletions: 1 },
          ],
        },
        reason: "handoff",
      }),
    );

    expect(block).toContain("## Core context");
    expect(block).toContain("Objective: Fix resume after provider switch");
    expect(block).toContain("Changed files: 2");
    expect(block).toContain("Incomplete: Reconnect path still uses legacy auth");
    expect(block).toContain("Next: Update resumeProviderSession()");
    expect(block).toContain("Checks: Not run");
    expect(block).toContain("Checkpoint: #184");
  });
});

describe("core context helpers", () => {
  it("classifies handoff seam turn ids", () => {
    expect(coreContextReasonFromHandoffTurnId("handoff:abc")).toBe("handoff");
    expect(coreContextReasonFromHandoffTurnId("handoff:model-switch:abc")).toBe("model-switch");
    expect(coreContextReasonFromHandoffTurnId("turn-12")).toBe("turn");
  });

  it("labels persisted activities by reason", () => {
    expect(coreContextActivitySummary("handoff")).toBe("Handoff checkpoint ready");
    expect(coreContextActivitySummary("turn")).toBe("Core context updated");
  });

  it("does not carry fallback-only context when there is nothing to replay", () => {
    const context = buildCoreContext({
      title: "New thread",
      messages: [],
      reason: "handoff",
    });
    expect(hasActionableCoreContext(context)).toBe(true);
    expect(shouldCarryCoreContext(context, false)).toBe(false);
    expect(
      shouldCarryCoreContext(
        buildCoreContext({
          title: "Ship handoff",
          messages: [],
          proposedPlans: [{ implementedAt: null, planMarkdown: "Next: keep going" }],
          reason: "handoff",
        }),
        false,
      ),
    ).toBe(true);
    expect(
      hasReplayableCoreContextMessages(
        [{ role: "user", text: "continue with claude" }],
        "continue with claude",
      ),
    ).toBe(false);
  });
});
