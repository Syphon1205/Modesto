import { describe, expect, it } from "@effect/vitest";

import type { EnvironmentId, OrchestrationThreadShell, ThreadId, TurnId } from "@modesto/contracts";
import { ProviderInstanceId } from "@modesto/contracts";

import {
  ambientBubbleRoutePath,
  ambientBubbleToneForPhase,
  awarenessStateToAmbientBubble,
  buildAmbientBubbles,
  liveSubagentStatusToPhase,
  liveSubagentToAmbientBubble,
  type AmbientLiveSubagentSummary,
} from "./ambientBubbles.ts";

const NOW = "2026-05-22T12:00:00.000Z";
const ENV = "env-1" as EnvironmentId;

function thread(
  overrides: Partial<
    Pick<
      OrchestrationThreadShell,
      | "id"
      | "title"
      | "modelSelection"
      | "session"
      | "latestTurn"
      | "updatedAt"
      | "hasPendingApprovals"
      | "hasPendingUserInput"
    >
  > = {},
): Pick<
  OrchestrationThreadShell,
  | "id"
  | "title"
  | "modelSelection"
  | "session"
  | "latestTurn"
  | "updatedAt"
  | "hasPendingApprovals"
  | "hasPendingUserInput"
> {
  return {
    id: "thread-1" as ThreadId,
    title: "Fix failing CI",
    modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
    session: null,
    latestTurn: null,
    updatedAt: NOW,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    ...overrides,
  };
}

describe("buildAmbientBubbles", () => {
  it("maps running awareness threads into soft bubbles", () => {
    const bubbles = buildAmbientBubbles({
      threads: [
        {
          environmentId: ENV,
          projectTitle: "modesto",
          thread: thread({
            session: {
              threadId: "thread-1" as ThreadId,
              status: "running",
              providerName: "Codex",
              runtimeMode: "full-access",
              activeTurnId: "turn-1" as TurnId,
              lastError: null,
              updatedAt: NOW,
            },
          }),
        },
        {
          environmentId: ENV,
          projectTitle: "modesto",
          thread: thread({ id: "thread-idle" as ThreadId, title: "Idle" }),
        },
      ],
    });

    expect(bubbles).toHaveLength(1);
    expect(bubbles[0]?.kind).toBe("thread");
    expect(bubbles[0]?.phase).toBe("running");
    expect(bubbles[0]?.label).toBe("F");
    expect(bubbles[0]?.deepLink).toBe("/threads/env-1/thread-1");
    expect(ambientBubbleRoutePath(bubbles[0]!)).toBe("/env-1/thread-1");
    expect(ambientBubbleToneForPhase(bubbles[0]!.phase)).toBe("active");
  });

  it("includes live subagent summaries and sorts waiting ahead of running", () => {
    const live: AmbientLiveSubagentSummary = {
      id: "agent-1",
      environmentId: ENV,
      threadId: "thread-1" as ThreadId,
      title: "Explore codebase",
      status: "running",
      progress: "Reading files",
      updatedAt: NOW,
    };

    const bubbles = buildAmbientBubbles({
      threads: [
        {
          environmentId: ENV,
          projectTitle: "modesto",
          thread: thread({
            hasPendingApprovals: true,
            session: {
              threadId: "thread-1" as ThreadId,
              status: "running",
              providerName: "Codex",
              runtimeMode: "full-access",
              activeTurnId: "turn-1" as TurnId,
              lastError: null,
              updatedAt: NOW,
            },
          }),
        },
      ],
      liveSubagents: [live],
    });

    expect(bubbles.map((bubble) => bubble.kind)).toEqual(["thread", "subagent"]);
    expect(bubbles[0]?.phase).toBe("waiting_for_approval");
    expect(bubbles[1]?.subtitle).toBe("Reading files");
    expect(liveSubagentStatusToPhase("waiting")).toBe("waiting_for_input");
  });

  it("drops completed/cancelled live subagents from the cluster", () => {
    const bubbles = buildAmbientBubbles({
      threads: [],
      liveSubagents: [
        {
          id: "done",
          environmentId: ENV,
          threadId: "thread-1" as ThreadId,
          title: "Done",
          status: "completed",
          updatedAt: NOW,
        },
        {
          id: "live",
          environmentId: ENV,
          threadId: "thread-1" as ThreadId,
          title: "Still going",
          status: "running",
          updatedAt: NOW,
        },
      ],
    });

    expect(bubbles).toHaveLength(1);
    expect(bubbles[0]?.title).toBe("Still going");
  });
});

describe("awarenessStateToAmbientBubble", () => {
  it("preserves deepLink and derives an initial label", () => {
    const bubble = awarenessStateToAmbientBubble({
      environmentId: ENV,
      threadId: "thread-9" as ThreadId,
      projectTitle: "modesto",
      threadTitle: "Ship ambient",
      phase: "completed",
      headline: "Agent finished",
      modelTitle: "gpt-5.4",
      updatedAt: NOW,
      deepLink: "/threads/env-1/thread-9",
    });

    expect(bubble.id).toContain("thread-9");
    expect(bubble.label).toBe("S");
    expect(ambientBubbleToneForPhase(bubble.phase)).toBe("success");
  });
});

describe("liveSubagentToAmbientBubble", () => {
  it("links back to the parent thread route", () => {
    const bubble = liveSubagentToAmbientBubble({
      id: "sa-1",
      environmentId: ENV,
      threadId: "thread-1" as ThreadId,
      title: "Worker",
      status: "failed",
      updatedAt: NOW,
    });

    expect(bubble.kind).toBe("subagent");
    expect(bubble.phase).toBe("failed");
    expect(ambientBubbleRoutePath(bubble)).toBe("/env-1/thread-1");
  });
});
