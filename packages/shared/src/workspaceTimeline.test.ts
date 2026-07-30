// FILE: workspaceTimeline.test.ts
// Purpose: Verifies provider-neutral workspace timeline derivation.
// Layer: Shared utility tests

import { EventId, ProjectId, ThreadId, TurnId } from "@modesto/contracts";
import { describe, expect, it } from "vitest";

import {
  buildWorkspaceTimeline,
  categorizeWorkspaceActivity,
  type WorkspaceTimelineThreadSnapshot,
} from "./workspaceTimeline";

describe("categorizeWorkspaceActivity", () => {
  it.each([
    ["tool.completed", "Globbed source files", "search"],
    ["tool.completed", "Ran vitest", "test"],
    ["tool.completed", "Applied patch to source", "edit"],
    ["tool.completed", "git commit -m context", "commit"],
    ["checkpoint.captured", "Checkpoint captured", "checkpoint"],
    ["thread.handoff.imported", "Handoff received", "handoff"],
    ["review.completed", "Code review complete", "review"],
    ["turn.started", "Agent turn started", "agent-start"],
    ["task.created", "Follow up", "task"],
    ["tool.completed", "Ran command", "run"],
  ] as const)("maps %s / %s to %s", (kind, summary, category) => {
    expect(categorizeWorkspaceActivity(kind, summary)).toBe(category);
  });
});

describe("buildWorkspaceTimeline", () => {
  const projectId = ProjectId.makeUnsafe("project-timeline");
  const threadId = ThreadId.makeUnsafe("thread-timeline");
  const turnId = TurnId.makeUnsafe("turn-timeline");
  const thread = {
    id: threadId,
    projectId,
    title: "Timeline thread",
    modelSelection: { provider: "claudeAgent", model: "claude-sonnet" },
    createdAt: "2026-07-30T00:00:00.000Z",
    activities: [
      {
        id: EventId.makeUnsafe("search-activity"),
        tone: "tool",
        kind: "tool.completed",
        summary: "Inspected workspace",
        payload: { itemType: "command_execution", data: { item: { command: "rg Context" } } },
        turnId,
        createdAt: "2026-07-30T00:02:00.000Z",
      },
      {
        id: EventId.makeUnsafe("test-activity"),
        tone: "tool",
        kind: "tool.completed",
        summary: "Verified implementation",
        payload: { itemType: "command_execution", detail: "bun vitest run" },
        turnId,
        createdAt: "2026-07-30T00:04:00.000Z",
      },
    ],
    checkpoints: [],
    proposedPlans: [
      {
        id: "plan-timeline",
        turnId,
        planMarkdown: "Implement timeline.",
        implementedAt: null,
        implementationThreadId: null,
        createdAt: "2026-07-30T00:03:00.000Z",
        updatedAt: "2026-07-30T00:03:00.000Z",
      },
    ],
    handoff: null,
  } satisfies WorkspaceTimelineThreadSnapshot;

  it("uses activity payload details and returns newest items first", () => {
    const items = buildWorkspaceTimeline([thread], { projectId });

    expect(items.map((item) => item.category)).toEqual(["test", "task", "search", "agent-start"]);
    expect(items[0]?.provider).toBe("claudeAgent");
    expect(items[0]?.relatedTurnId).toBe(turnId);
  });

  it("applies category filters and limits after sorting", () => {
    const items = buildWorkspaceTimeline([thread], {
      filter: { categories: ["search", "test"] },
      limit: 1,
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.category).toBe("test");
  });
});
