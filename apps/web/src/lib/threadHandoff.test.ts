import { CheckpointRef, MessageId, type GitStatusResult, type ModelSelection } from "@modesto/contracts";
import { describe, expect, it } from "vitest";
import {
  buildDefaultHandoffObjective,
  buildDefaultHandoffSummary,
  buildHandoffSeamPresentation,
  buildHandoffUnfinishedSteps,
  buildThreadHandoffRepoSnapshotFromGit,
  resolveAvailableHandoffTargetProviders,
  resolveHandoffDiffAckStatus,
  resolveThreadHandoffTitle,
  resolveThreadHandoffModelSelection,
} from "./threadHandoff";
import type { Thread } from "../types";

const baseThread = {
  title: "Fix handoff flow",
  notes: "",
  messages: [
    {
      id: MessageId.makeUnsafe("msg-1"),
      role: "user" as const,
      text: "Implement provider handoff UI",
      streaming: false,
      createdAt: "2026-07-27T12:00:00.000Z",
    },
    {
      id: MessageId.makeUnsafe("msg-2"),
      role: "assistant" as const,
      text: "I'll add the dialog and repo snapshot capture.",
      streaming: false,
      createdAt: "2026-07-27T12:01:00.000Z",
    },
  ],
  proposedPlans: [
    {
      id: "plan:thread-1:turn:turn-1",
      turnId: null,
      planMarkdown: "## Plan\n\n- [ ] Wire dialog\n- [x] Add helpers\n- [ ] Capture git snapshot",
      implementedAt: null,
      implementationThreadId: null,
      createdAt: "2026-07-27T12:02:00.000Z",
      updatedAt: "2026-07-27T12:02:00.000Z",
    },
  ],
  pinnedMessages: [
    {
      messageId: MessageId.makeUnsafe("msg-1"),
      label: "Verify return banner",
      done: false,
      pinnedAt: "2026-07-27T12:03:00.000Z",
    },
  ],
} satisfies Pick<Thread, "title" | "notes" | "messages" | "proposedPlans" | "pinnedMessages">;

const gitStatus = {
  branch: "feature/handoff",
  hasWorkingTreeChanges: true,
  workingTree: {
    files: [{ path: "apps/web/src/lib/threadHandoff.ts", insertions: 12, deletions: 2 }],
    insertions: 12,
    deletions: 2,
  },
  hasUpstream: true,
  upstreamBranch: "origin/feature/handoff",
  aheadCount: 1,
  behindCount: 0,
  pr: null,
} satisfies GitStatusResult;

describe("threadHandoff", () => {
  it("lists all supported handoff targets except the active provider", () => {
    expect(resolveAvailableHandoffTargetProviders("codex")).toEqual([
      "claudeAgent",
      "cursor",
      "gemini",
      "grok",
      "droid",
      "kilo",
      "opencode",
      "pi",
    ]);
    expect(resolveAvailableHandoffTargetProviders("claudeAgent")).toEqual([
      "codex",
      "cursor",
      "gemini",
      "grok",
      "droid",
      "kilo",
      "opencode",
      "pi",
    ]);
    expect(resolveAvailableHandoffTargetProviders("cursor")).toEqual([
      "codex",
      "claudeAgent",
      "gemini",
      "grok",
      "droid",
      "kilo",
      "opencode",
      "pi",
    ]);
    expect(resolveAvailableHandoffTargetProviders("gemini")).toEqual([
      "codex",
      "claudeAgent",
      "cursor",
      "grok",
      "droid",
      "kilo",
      "opencode",
      "pi",
    ]);
    expect(resolveAvailableHandoffTargetProviders("grok")).toEqual([
      "codex",
      "claudeAgent",
      "cursor",
      "gemini",
      "droid",
      "kilo",
      "opencode",
      "pi",
    ]);
    expect(resolveAvailableHandoffTargetProviders("droid")).toEqual([
      "codex",
      "claudeAgent",
      "cursor",
      "gemini",
      "grok",
      "kilo",
      "opencode",
      "pi",
    ]);
    expect(resolveAvailableHandoffTargetProviders("kilo")).toEqual([
      "codex",
      "claudeAgent",
      "cursor",
      "gemini",
      "grok",
      "droid",
      "opencode",
      "pi",
    ]);
    expect(resolveAvailableHandoffTargetProviders("opencode")).toEqual([
      "codex",
      "claudeAgent",
      "cursor",
      "gemini",
      "grok",
      "droid",
      "kilo",
      "pi",
    ]);
    expect(resolveAvailableHandoffTargetProviders("pi")).toEqual([
      "codex",
      "claudeAgent",
      "cursor",
      "gemini",
      "grok",
      "droid",
      "kilo",
      "opencode",
    ]);
  });

  it("preserves the source thread title for the created handoff thread", () => {
    expect(resolveThreadHandoffTitle({ title: "General Greeting" })).toBe("General Greeting");
    expect(resolveThreadHandoffTitle({ title: "  Debug   Grok handoff  " })).toBe(
      "Debug Grok handoff",
    );
  });

  it("builds a default handoff summary from the latest assistant message", () => {
    const summary = buildDefaultHandoffSummary(baseThread);
    expect(summary).toBe("I'll add the dialog and repo snapshot capture.");
  });

  it("builds a scannable handoff seam presentation", () => {
    const presentation = buildHandoffSeamPresentation({
      handoff: {
        sourceProvider: "claudeAgent",
        summary: "Implemented authentication callback handling.",
        objective: "Add refresh retry handling and run auth integration tests.",
        unfinishedSteps: [
          { id: "1", text: "Token refresh logic is incomplete.", status: "todo" },
        ],
        repoSnapshot: {
          headSha: "abc",
          branch: "feature/auth",
          worktreePath: null,
          hasWorkingTreeChanges: true,
          changedFiles: [{ path: "auth.ts", insertions: 4, deletions: 1 }],
          statusSummary: null,
          diffSummaryMarkdown: null,
          capturedAt: "2026-07-27T12:00:00.000Z",
        },
        checkpointRef: CheckpointRef.makeUnsafe("refs/modesto/agent-checkpoints/source/dest/tree"),
        checkpointStatus: "captured",
      },
      targetProvider: "codex",
    });
    expect(presentation.fromLabel).toBe("Claude");
    expect(presentation.toLabel).toBe("Codex");
    expect(presentation.doneLines).toEqual(["Implemented authentication callback handling."]);
    expect(presentation.incompleteLines).toEqual(["Token refresh logic is incomplete."]);
    expect(presentation.nextLines).toEqual([
      "Add refresh retry handling and run auth integration tests.",
    ]);
    expect(presentation.repoLine).toBe("feature/auth · 1 changed file");
    expect(presentation.checkpointLine).toBe("Durable seam checkpoint captured");
    expect(presentation.canInspectCheckpoint).toBe(true);
    expect(presentation.canRollbackCheckpoint).toBe(true);
  });

  it("builds a default objective from the latest user message", () => {
    expect(buildDefaultHandoffObjective(baseThread)).toBe("Implement provider handoff UI");
  });

  it("builds unfinished steps from open plan items and unfinished pins", () => {
    expect(buildHandoffUnfinishedSteps(baseThread)).toEqual([
      {
        id: "plan:plan:thread-1:turn:turn-1:0",
        text: "Wire dialog",
        status: "todo",
      },
      {
        id: "plan:plan:thread-1:turn:turn-1:2",
        text: "Capture git snapshot",
        status: "todo",
      },
      {
        id: "pin:msg-1",
        text: "Verify return banner",
        status: "todo",
      },
    ]);
  });

  it("maps git status into a repo snapshot", () => {
    expect(
      buildThreadHandoffRepoSnapshotFromGit({
        status: gitStatus,
        diffSummaryMarkdown: "- Added handoff dialog",
        worktreePath: "/tmp/worktree",
        capturedAt: "2026-07-27T12:04:00.000Z",
        headSha: "abc123",
      }),
    ).toMatchObject({
      branch: "feature/handoff",
      worktreePath: "/tmp/worktree",
      hasWorkingTreeChanges: true,
      headSha: "abc123",
      changedFiles: [{ path: "apps/web/src/lib/threadHandoff.ts", insertions: 12, deletions: 2 }],
      diffSummaryMarkdown: "- Added handoff dialog",
    });
  });

  it("resolves diff ack status from repo dirtiness when not explicit", () => {
    const snapshot = buildThreadHandoffRepoSnapshotFromGit({
      status: gitStatus,
      capturedAt: "2026-07-27T12:04:00.000Z",
    });
    expect(resolveHandoffDiffAckStatus({ repoSnapshot: snapshot })).toBe("pending");
    expect(
      resolveHandoffDiffAckStatus({
        repoSnapshot: {
          ...snapshot,
          hasWorkingTreeChanges: false,
        },
      }),
    ).toBe("not_required");
    expect(resolveHandoffDiffAckStatus({ explicit: "acknowledged", repoSnapshot: snapshot })).toBe(
      "acknowledged",
    );
  });

  it("prefers sticky model selection for the chosen handoff target", () => {
    const stickySelection = {
      provider: "gemini",
      model: "gemini-2.5-pro",
    } satisfies ModelSelection;

    expect(
      resolveThreadHandoffModelSelection({
        sourceThread: {
          modelSelection: {
            provider: "claudeAgent",
            model: "claude-sonnet-4-6",
          },
        },
        targetProvider: "gemini",
        projectDefaultModelSelection: {
          provider: "gemini",
          model: "gemini-3.1-pro-preview",
        },
        stickyModelSelectionByProvider: {
          gemini: stickySelection,
        },
      }),
    ).toEqual(stickySelection);
  });

  it("falls back to the resolved provider default model when no sticky or project default exists", () => {
    expect(
      resolveThreadHandoffModelSelection({
        sourceThread: {
          modelSelection: {
            provider: "gemini",
            model: "gemini-2.5-pro",
          },
        },
        targetProvider: "codex",
        projectDefaultModelSelection: null,
        stickyModelSelectionByProvider: {},
      }),
    ).toEqual({
      provider: "codex",
      model: "gpt-5.5",
    });
  });
});
