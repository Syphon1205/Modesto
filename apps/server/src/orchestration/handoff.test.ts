import { assert, it } from "@effect/vitest";

import {
  CheckpointRef,
  MessageId,
  ThreadId,
  type OrchestrationMessage,
  type OrchestrationThread,
  type ThreadHandoffReturnPayload,
} from "@modesto/contracts";

import {
  buildHandoffBootstrapText,
  buildHandoffReturnBootstrapText,
  resolveHandoffDiffAckStatus,
} from "./handoff";

const baseMessage = (overrides: Partial<OrchestrationMessage> = {}): OrchestrationMessage => ({
  id: MessageId.makeUnsafe("msg-1"),
  role: "user",
  text: "hello",
  turnId: null,
  source: "native",
  streaming: false,
  provenance: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const baseThread = (
  overrides: Partial<
    Pick<OrchestrationThread, "title" | "branch" | "worktreePath" | "handoff" | "messages">
  > = {},
): Pick<OrchestrationThread, "title" | "branch" | "worktreePath" | "handoff" | "messages"> => ({
  title: "Auth refactor",
  branch: "feature/auth",
  worktreePath: null,
  handoff: {
    sourceThreadId: ThreadId.makeUnsafe("thread-source"),
    sourceProvider: "codex",
    importedAt: "2026-01-01T00:00:00.000Z",
    bootstrapStatus: "pending",
    summary: "Finish token refresh and add tests.",
    objective: "Ship refresh-token support.",
    unfinishedSteps: [{ id: "step-1", text: "Add integration test", status: "todo" }],
    repoSnapshot: {
      branch: "feature/auth",
      worktreePath: null,
      headSha: "abc123",
      hasWorkingTreeChanges: true,
      changedFiles: [{ path: "apps/server/src/auth.ts", insertions: 12, deletions: 3 }],
      statusSummary: "1 file changed",
      diffSummaryMarkdown: "- auth.ts: refresh flow",
      capturedAt: "2026-01-01T00:00:00.000Z",
    },
    diffAckStatus: "pending",
    checkpointRef: null,
    baseCheckpointRef: null,
    baseHeadSha: null,
    checkpointStatus: "not_applicable",
  },
  messages: [
    baseMessage({
      id: MessageId.makeUnsafe("imported-1"),
      role: "assistant",
      source: "handoff-import",
      text: "I started the refresh flow.",
    }),
  ],
  ...overrides,
});

it("buildHandoffBootstrapText includes summary, steps, repo state, and diff ack", () => {
  const text = buildHandoffBootstrapText(baseThread());
  assert.isNotNull(text);
  assert.include(text!, "HANDOFF SEAM from Codex");
  assert.include(text!, "What landed:");
  assert.include(text!, "Finish token refresh and add tests.");
  assert.include(text!, "Next step:");
  assert.include(text!, "Incomplete work");
  assert.include(text!, "Add integration test");
  assert.include(text!, "REPOSITORY STATE");
  assert.include(text!, "Branch: feature/auth");
  assert.include(text!, "DIFF REVIEW REQUIRED");
});

it("buildHandoffBootstrapText includes agent checkpoint when captured", () => {
  const thread = baseThread({
    handoff: {
      ...baseThread().handoff!,
      checkpointRef: CheckpointRef.makeUnsafe(
        "refs/modesto/agent-checkpoints/source/dest/tree",
      ),
      checkpointStatus: "captured",
    },
  });
  const text = buildHandoffBootstrapText(thread);
  assert.isNotNull(text);
  assert.include(text!, "AGENT CHECKPOINT:");
  assert.include(text!, "durable hidden checkpoint");
});

it("buildHandoffBootstrapText carries the shared context narrative to the next provider", () => {
  const thread = baseThread({
    handoff: {
      ...baseThread().handoff!,
      contextArtifactIds: ["task:server", "checkpoint:one"],
      contextNarrative: "## Continue from here\n- Wire the shared-context RPC.",
    },
  });
  const text = buildHandoffBootstrapText(thread);
  assert.isNotNull(text);
  assert.include(text!, "SHARED CONTEXT BUNDLE:");
  assert.include(text!, "Wire the shared-context RPC.");
});

it("buildHandoffBootstrapText omits diff ack when not pending", () => {
  const thread = baseThread({
    handoff: {
      ...baseThread().handoff!,
      diffAckStatus: "not_required",
    },
  });
  const text = buildHandoffBootstrapText(thread);
  assert.isNotNull(text);
  assert.notInclude(text!, "DIFF REVIEW REQUIRED");
});

it("resolveHandoffDiffAckStatus prefers explicit status and falls back to repo snapshot", () => {
  assert.strictEqual(resolveHandoffDiffAckStatus({ explicit: "acknowledged" }), "acknowledged");
  assert.strictEqual(
    resolveHandoffDiffAckStatus({
      repoSnapshot: {
        branch: "main",
        worktreePath: null,
        headSha: "abc",
        hasWorkingTreeChanges: true,
        changedFiles: [],
        statusSummary: null,
        diffSummaryMarkdown: null,
        capturedAt: "2026-01-01T00:00:00.000Z",
      },
    }),
    "pending",
  );
  assert.strictEqual(
    resolveHandoffDiffAckStatus({
      repoSnapshot: {
        branch: "main",
        worktreePath: null,
        headSha: "abc",
        hasWorkingTreeChanges: false,
        changedFiles: [],
        statusSummary: null,
        diffSummaryMarkdown: null,
        capturedAt: "2026-01-01T00:00:00.000Z",
      },
    }),
    "not_required",
  );
});

it("buildHandoffReturnBootstrapText includes return summary and repo snapshot", () => {
  const payload: ThreadHandoffReturnPayload = {
    fromThreadId: ThreadId.makeUnsafe("thread-handoff"),
    fromProvider: "claudeAgent",
    summary: "Completed refresh flow and added tests.",
    repoSnapshot: {
      branch: "feature/auth",
      worktreePath: null,
      headSha: "def456",
      hasWorkingTreeChanges: false,
      changedFiles: [],
      statusSummary: "clean",
      diffSummaryMarkdown: null,
      capturedAt: "2026-01-02T00:00:00.000Z",
    },
    completedStepIds: ["step-1"],
    returnedAt: "2026-01-02T00:00:00.000Z",
  };

  const text = buildHandoffReturnBootstrapText(payload);
  assert.include(text, "HANDOFF RETURN from Claude");
  assert.include(text, "Completed refresh flow and added tests.");
  assert.include(text, "Completed step ids");
  assert.include(text, "Branch: feature/auth");
  assert.include(text, "Do not redo work");
});
