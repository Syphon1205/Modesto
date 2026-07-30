import { describe, expect, it } from "vitest";

import type { Thread } from "../types";
import {
  buildTeamsAssignments,
  buildTeamsParticipants,
  buildTeamsReviews,
  buildTeamsRuns,
  buildTeamsTimeline,
  teamsRunStatus,
  teamsTimelineCategory,
} from "./teamsSpace";

function thread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: "thread-1" as Thread["id"],
    codexThreadId: null,
    projectId: "project-1" as Thread["projectId"],
    title: "Patch Teams",
    modelSelection: { provider: "codex", model: "gpt-5.6" },
    runtimeMode: "full-access",
    interactionMode: "default",
    branch: "codex/teams",
    worktreePath: null,
    session: null,
    messages: [],
    proposedPlans: [],
    error: null,
    createdAt: "2026-07-29T10:00:00.000Z",
    updatedAt: "2026-07-29T11:00:00.000Z",
    latestTurn: null,
    turnDiffSummaries: [],
    activities: [],
    ...overrides,
  };
}

describe("teamsSpace", () => {
  it("prioritizes recovery and human attention over generic session state", () => {
    expect(teamsRunStatus(thread({ error: "provider exited" }))).toBe("failed");
    expect(teamsRunStatus(thread({ hasPendingApprovals: true }))).toBe("waiting");
    expect(
      teamsRunStatus(
        thread({
          latestTurn: {
            turnId: "turn-1" as NonNullable<Thread["latestTurn"]>["turnId"],
            state: "running",
            requestedAt: "2026-07-29T10:30:00.000Z",
            startedAt: "2026-07-29T10:30:00.000Z",
            completedAt: null,
            assistantMessageId: null,
          },
        }),
      ),
    ).toBe("running");
  });

  it("projects and filters the shared workspace event log", () => {
    const source = thread({
      proposedPlans: [
        {
          id: "plan-1",
          turnId: null,
          planMarkdown: "## Finish Teams\n\n- [ ] Add timeline filters",
          implementedAt: null,
          implementationThreadId: null,
          createdAt: "2026-07-29T11:00:30.000Z",
          updatedAt: "2026-07-29T11:00:30.000Z",
        },
      ],
      activities: [
        {
          id: "event-1" as Thread["activities"][number]["id"],
          tone: "tool",
          kind: "agent.checkpoint.declared",
          summary: "Checkpoint ready",
          payload: {},
          turnId: null,
          createdAt: "2026-07-29T11:01:00.000Z",
        },
        {
          id: "event-2" as Thread["activities"][number]["id"],
          tone: "info",
          kind: "turn.completed",
          summary: "Run completed",
          payload: {},
          turnId: null,
          createdAt: "2026-07-29T11:02:00.000Z",
        },
        {
          id: "event-3" as Thread["activities"][number]["id"],
          tone: "tool",
          kind: "tool.completed",
          summary: "Searched workspace with ripgrep",
          payload: { toolName: "rg" },
          turnId: null,
          createdAt: "2026-07-29T11:03:00.000Z",
        },
        {
          id: "event-4" as Thread["activities"][number]["id"],
          tone: "tool",
          kind: "tool.completed",
          summary: "Ran bun test",
          payload: { command: "bun test" },
          turnId: null,
          createdAt: "2026-07-29T11:04:00.000Z",
        },
      ],
    });

    expect(buildTeamsTimeline([source], "all").map((item) => item.category)).toEqual([
      "tests",
      "searches",
      "runs",
      "checkpoints",
      "assignments",
      "runs",
    ]);
    expect(buildTeamsTimeline([source], "checkpoints")).toHaveLength(1);
    expect(teamsTimelineCategory("review.completed")).toBe("reviews");
    expect(teamsTimelineCategory("file.edit")).toBe("edits");
    expect(teamsTimelineCategory("git.commit.created")).toBe("commits");
    expect(teamsTimelineCategory("unrelated")).toBe("runs");
  });

  it("builds assignments from handoffs, plans, and runs needing attention", () => {
    const assignments = buildTeamsAssignments([
      thread({
        hasPendingUserInput: true,
        proposedPlans: [
          {
            id: "plan-1",
            turnId: null,
            planMarkdown: "# Ship shared context\n\n- [ ] Add panel",
            implementedAt: null,
            implementationThreadId: null,
            createdAt: "2026-07-29T11:02:00.000Z",
            updatedAt: "2026-07-29T11:03:00.000Z",
          },
        ],
        handoff: {
          sourceThreadId: "source-thread" as Thread["id"],
          sourceProvider: "claudeAgent",
          importedAt: "2026-07-29T11:04:00.000Z",
          bootstrapStatus: "completed",
          summary: null,
          objective: null,
          unfinishedSteps: [
            { id: "step-1", text: "Run UI tests", status: "todo" },
            { id: "step-2", text: "Already done", status: "done" },
          ],
          contextArtifactIds: [],
          contextNarrative: null,
          repoSnapshot: null,
          diffAckStatus: "not_required",
          checkpointRef: null,
          baseCheckpointRef: null,
          baseHeadSha: null,
          checkpointStatus: "not_applicable",
        },
      }),
    ]);

    expect(assignments.map((assignment) => assignment.kind)).toEqual([
      "handoff-step",
      "plan",
      "attention",
    ]);
    expect(assignments[0]).toMatchObject({ label: "Run UI tests", status: "todo" });
    expect(assignments[1]).toMatchObject({ label: "Ship shared context", status: "ready" });
    expect(assignments[2]).toMatchObject({ label: "Input needed", status: "waiting" });
  });

  it("builds reviews from workspace review activity", () => {
    const reviews = buildTeamsReviews([
      thread({
        handoffReturn: {
          fromThreadId: "returned-thread" as Thread["id"],
          fromProvider: "claudeAgent",
          summary: "Finished the context panel",
          repoSnapshot: null,
          completedStepIds: ["step-1"],
          returnedAt: "2026-07-29T11:06:00.000Z",
        },
        activities: [
          {
            id: "review-1" as Thread["activities"][number]["id"],
            tone: "info",
            kind: "review.requested",
            summary: "Review shared context panel",
            payload: {},
            turnId: null,
            createdAt: "2026-07-29T11:05:00.000Z",
          },
        ],
      }),
    ]);

    expect(reviews).toEqual([
      expect.objectContaining({
        kind: "handoff-return",
        label: "Returned work: Finished the context panel",
        status: "ready",
      }),
      expect.objectContaining({
        kind: "activity",
        label: "Review shared context panel",
        status: "ready",
      }),
    ]);
  });

  it("summarizes run ownership for people and agents", () => {
    const runs = buildTeamsRuns([
      thread({ hasPendingUserInput: true }),
      thread({
        id: "thread-2" as Thread["id"],
        modelSelection: { provider: "claudeAgent", model: "sonnet" },
      }),
    ]);
    const participants = buildTeamsParticipants(
      [
        thread({ hasPendingUserInput: true }),
        thread({
          id: "thread-2" as Thread["id"],
          modelSelection: { provider: "claudeAgent", model: "sonnet" },
          parentThreadId: "thread-1" as Thread["id"],
          subagentAgentId: "agent-42",
          subagentNickname: "Noether",
          subagentRole: "reviewer",
        }),
      ],
      runs,
    );

    expect(participants[0]).toMatchObject({ label: "You", runCount: 2, activeRunCount: 1 });
    expect(participants.map((participant) => participant.label)).toContain("Codex");
    expect(participants.map((participant) => participant.label)).toContain("Claude");
    expect(participants).toContainEqual(
      expect.objectContaining({
        id: "subagent:agent-42",
        label: "Noether",
        detail: "Subagent · reviewer · Claude · agent-42",
        runCount: 1,
      }),
    );
  });
});
