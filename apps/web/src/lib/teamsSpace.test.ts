import { describe, expect, it } from "vitest";

import type { Thread } from "../types";
import {
  buildTeamsParticipants,
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
    runtimeMode: "fullAccess",
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
            completedAt: null,
            sourceProposedPlan: null,
          },
        }),
      ),
    ).toBe("running");
  });

  it("projects and filters the shared event log", () => {
    const source = thread({
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
      ],
    });

    expect(buildTeamsTimeline([source], "all").map((item) => item.category)).toEqual([
      "runs",
      "checkpoints",
    ]);
    expect(buildTeamsTimeline([source], "checkpoints")).toHaveLength(1);
    expect(teamsTimelineCategory("review.completed")).toBe("reviews");
    expect(teamsTimelineCategory("unrelated")).toBeNull();
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
        }),
      ],
      runs,
    );

    expect(participants[0]).toMatchObject({ label: "You", runCount: 2, activeRunCount: 1 });
    expect(participants.map((participant) => participant.label)).toContain("Codex");
    expect(participants.map((participant) => participant.label)).toContain("Claude");
  });
});
