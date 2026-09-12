import { renderToStaticMarkup } from "react-dom/server";
import { ThreadId } from "@modesto/contracts";
import { describe, expect, it } from "vite-plus/test";

import { emptyAgentPanelModel } from "@modesto/client-runtime/state/subagentRuntime";

import { AgentsPanel } from "./AgentsPanel";

describe("AgentsPanel spawned chats", () => {
  it("lists sidechats and multiagent children when the provider roster is empty", () => {
    const markup = renderToStaticMarkup(
      <AgentsPanel
        model={emptyAgentPanelModel()}
        spawnedThreads={[
          {
            id: ThreadId.make("thread-side"),
            title: "What broke in auth?",
            conversationMode: "chat",
            parentThreadId: ThreadId.make("thread-parent"),
            createdAt: "2026-09-07T12:01:00.000Z",
            latestTurn: null,
          },
          {
            id: ThreadId.make("thread-multi"),
            title: "investigate the flaky auth test",
            conversationMode: "code",
            parentThreadId: ThreadId.make("thread-parent"),
            createdAt: "2026-09-07T12:00:00.000Z",
            latestTurn: {
              turnId: "turn-1" as never,
              state: "running",
              requestedAt: "2026-09-07T12:00:00.000Z",
              startedAt: "2026-09-07T12:00:00.000Z",
              completedAt: null,
              assistantMessageId: null,
            },
          },
        ]}
      />,
    );

    expect(markup).toContain("Spawned chats");
    expect(markup).toContain("What broke in auth?");
    expect(markup).toContain("Sidechat");
    expect(markup).toContain("investigate the flaky auth test");
    expect(markup).toContain("Multi-Agent");
    expect(markup).not.toContain("No agents yet");
  });

  it("keeps the empty state when nothing has been spawned", () => {
    const markup = renderToStaticMarkup(<AgentsPanel model={emptyAgentPanelModel()} />);

    expect(markup).toContain("No agents yet");
    expect(markup).toContain("Sidechats, additional agents, and provider subagents");
  });
});
