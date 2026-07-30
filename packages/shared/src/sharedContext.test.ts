// FILE: sharedContext.test.ts
// Purpose: Verifies portable context derivation from existing thread state.
// Layer: Shared utility tests

import { CheckpointRef, EventId, MessageId, ProjectId, ThreadId, TurnId } from "@modesto/contracts";
import { describe, expect, it } from "vitest";

import {
  buildSharedContextBundle,
  formatSharedContextNarrative,
  type SharedContextThreadSnapshot,
} from "./sharedContext";

const threadId = ThreadId.makeUnsafe("thread-context");
const projectId = ProjectId.makeUnsafe("project-context");
const turn1 = TurnId.makeUnsafe("turn-1");
const turn2 = TurnId.makeUnsafe("turn-2");
const checkpoint1 = CheckpointRef.makeUnsafe("refs/modesto/threads/thread-context/turns/1");
const checkpoint2 = CheckpointRef.makeUnsafe("refs/modesto/threads/thread-context/turns/2");

const thread = {
  id: threadId,
  projectId,
  title: "Shared context work",
  modelSelection: { provider: "codex", model: "gpt-5.6" },
  createdAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:09:00.000Z",
  session: {
    threadId,
    status: "ready",
    providerName: "Codex",
    runtimeMode: "full-access",
    activeTurnId: null,
    lastError: null,
    updatedAt: "2026-07-30T00:09:00.000Z",
  },
  checkpoints: [
    {
      turnId: turn1,
      checkpointTurnCount: 1,
      checkpointRef: checkpoint1,
      status: "ready",
      files: [{ path: "src/context.ts", kind: "modified", additions: 20, deletions: 2 }],
      assistantMessageId: MessageId.makeUnsafe("assistant-1"),
      completedAt: "2026-07-30T00:04:00.000Z",
    },
    {
      turnId: turn2,
      checkpointTurnCount: 2,
      checkpointRef: checkpoint2,
      status: "ready",
      files: [{ path: "src/timeline.ts", kind: "added", additions: 30, deletions: 0 }],
      assistantMessageId: MessageId.makeUnsafe("assistant-2"),
      completedAt: "2026-07-30T00:08:00.000Z",
    },
  ],
  activities: [
    {
      id: EventId.makeUnsafe("web-search"),
      tone: "tool",
      kind: "tool.completed",
      summary: "Searched Effect Schema docs",
      payload: { itemType: "web_search", data: { query: "Effect Schema defaults" } },
      turnId: turn1,
      createdAt: "2026-07-30T00:02:00.000Z",
    },
    {
      id: EventId.makeUnsafe("terminal-test"),
      tone: "tool",
      kind: "tool.completed",
      summary: "Ran tests",
      payload: { itemType: "command_execution", detail: "bun vitest run" },
      turnId: turn2,
      createdAt: "2026-07-30T00:07:00.000Z",
    },
  ],
  messages: [
    {
      id: MessageId.makeUnsafe("user-1"),
      role: "user",
      text: "Build shared context.",
      turnId: turn1,
      streaming: false,
      source: "native",
      provenance: null,
      createdAt: "2026-07-30T00:01:00.000Z",
      updatedAt: "2026-07-30T00:01:00.000Z",
    },
    {
      id: MessageId.makeUnsafe("assistant-1"),
      role: "assistant",
      text: "Added the context collector.",
      turnId: turn1,
      streaming: false,
      source: "native",
      provenance: null,
      createdAt: "2026-07-30T00:03:00.000Z",
      updatedAt: "2026-07-30T00:03:00.000Z",
    },
    {
      id: MessageId.makeUnsafe("assistant-2"),
      role: "assistant",
      text: "Added the timeline.",
      turnId: turn2,
      streaming: false,
      source: "native",
      provenance: null,
      createdAt: "2026-07-30T00:08:00.000Z",
      updatedAt: "2026-07-30T00:08:00.000Z",
    },
  ],
  proposedPlans: [
    {
      id: "plan-1",
      turnId: turn2,
      planMarkdown: "Wire the shared context into the Teams UI.",
      implementedAt: null,
      implementationThreadId: null,
      createdAt: "2026-07-30T00:06:00.000Z",
      updatedAt: "2026-07-30T00:06:00.000Z",
    },
  ],
  handoff: {
    sourceThreadId: ThreadId.makeUnsafe("source-thread"),
    sourceProvider: "claudeAgent",
    importedAt: "2026-07-30T00:00:30.000Z",
    bootstrapStatus: "pending",
    summary: "Contracts are ready.",
    objective: "Finish server wiring.",
    unfinishedSteps: [{ id: "server", text: "Wire server RPCs", status: "todo" }],
    contextArtifactIds: [],
    contextNarrative: null,
    repoSnapshot: {
      headSha: "abc123",
      branch: "feature/context",
      worktreePath: null,
      hasWorkingTreeChanges: true,
      changedFiles: [
        { path: "packages/contracts/src/orchestration.ts", insertions: 40, deletions: 0 },
      ],
      statusSummary: "1 file changed",
      diffSummaryMarkdown: null,
      capturedAt: "2026-07-30T00:00:20.000Z",
    },
    diffAckStatus: "pending",
    checkpointRef: null,
    baseCheckpointRef: null,
    baseHeadSha: null,
    checkpointStatus: "not_applicable",
  },
  pinnedMessages: [
    {
      messageId: MessageId.makeUnsafe("assistant-1"),
      label: "Collector implementation",
      done: false,
      pinnedAt: "2026-07-30T00:05:00.000Z",
    },
  ],
  notes: "Keep the bundle provider-neutral.",
} satisfies SharedContextThreadSnapshot;

describe("buildSharedContextBundle", () => {
  it("assembles checkpoints, files, sources, terminal work, plans, and unfinished tasks", () => {
    const bundle = buildSharedContextBundle({
      thread,
      generatedAt: "2026-07-30T00:10:00.000Z",
    });

    expect(bundle.provider).toBe("codex");
    expect(bundle.artifacts.map((entry) => entry.kind)).toEqual(
      expect.arrayContaining([
        "session",
        "checkpoint",
        "file",
        "source",
        "terminal",
        "plan",
        "unfinished-task",
        "pin",
        "note",
        "handoff",
        "git-change",
      ]),
    );
    expect(
      bundle.artifacts.find((entry) => entry.id === `checkpoint:${checkpoint2}`)?.freshness,
    ).toBe("current");
    expect(bundle.narrative).toContain("Wire server RPCs");
    expect(bundle.narrative).toContain("src/timeline.ts");
  });

  it("limits historical artifacts when preparing checkpoint resume context", () => {
    const bundle = buildSharedContextBundle({
      thread,
      checkpointTurnCount: 1,
      generatedAt: "2026-07-30T00:10:00.000Z",
    });

    expect(bundle.artifacts.some((entry) => entry.checkpointRef === checkpoint2)).toBe(false);
    expect(bundle.artifacts.some((entry) => entry.summary.includes("Added the timeline"))).toBe(
      false,
    );
    expect(bundle.artifacts.some((entry) => entry.summary.includes("collector"))).toBe(true);
  });
});

describe("formatSharedContextNarrative", () => {
  it("omits superseded artifacts from compact handoff text", () => {
    const bundle = buildSharedContextBundle({
      thread,
      generatedAt: "2026-07-30T00:10:00.000Z",
    });
    const narrative = formatSharedContextNarrative({
      ...bundle,
      artifacts: [
        ...bundle.artifacts,
        {
          id: "old-note",
          kind: "note",
          label: "Old note",
          summary: "Do not carry this forward.",
          freshness: "superseded",
        },
      ],
    });

    expect(narrative).not.toContain("Do not carry this forward");
  });
});
