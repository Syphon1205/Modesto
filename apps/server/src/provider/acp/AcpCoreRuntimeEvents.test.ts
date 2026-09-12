import { ProviderDriverKind, RuntimeRequestId, TurnId } from "@modesto/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  makeAcpAssistantItemEvent,
  makeAcpContentDeltaEvent,
  makeAcpPlanUpdatedEvent,
  makeAcpRequestOpenedEvent,
  makeAcpRequestResolvedEvent,
  makeAcpTokenUsageEvent,
  makeAcpToolCallEvent,
} from "./AcpCoreRuntimeEvents.ts";

describe("AcpCoreRuntimeEvents", () => {
  it("maps ACP permission requests to canonical runtime events", () => {
    const stamp = { eventId: "event-1" as never, createdAt: "2026-03-27T00:00:00.000Z" };
    const turnId = TurnId.make("turn-1");
    const permissionRequest = {
      kind: "execute" as const,
      detail: "cat package.json",
      toolCall: {
        toolCallId: "tool-1",
        kind: "execute",
        status: "pending" as const,
        command: "cat package.json",
        detail: "cat package.json",
        data: { toolCallId: "tool-1", kind: "execute" },
      },
    };

    expect(
      makeAcpRequestOpenedEvent({
        stamp,
        provider: ProviderDriverKind.make("cursor"),
        threadId: "thread-1" as never,
        turnId,
        requestId: RuntimeRequestId.make("request-1"),
        permissionRequest,
        detail: "cat package.json",
        args: { command: ["cat", "package.json"] },
        source: "acp.jsonrpc",
        method: "session/request_permission",
        rawPayload: { sessionId: "session-1" },
      }),
    ).toMatchObject({
      type: "request.opened",
      payload: {
        requestType: "exec_command_approval",
        detail: "cat package.json",
      },
    });

    expect(
      makeAcpRequestResolvedEvent({
        stamp,
        provider: ProviderDriverKind.make("cursor"),
        threadId: "thread-1" as never,
        turnId,
        requestId: RuntimeRequestId.make("request-1"),
        permissionRequest,
        decision: "accept",
      }),
    ).toMatchObject({
      type: "request.resolved",
      payload: {
        requestType: "exec_command_approval",
        decision: "accept",
      },
    });
  });

  it("maps generic ACP permission kinds to dynamic tool approvals", () => {
    const stamp = { eventId: "event-1" as never, createdAt: "2026-03-27T00:00:00.000Z" };

    for (const kind of ["search", "fetch", "other", "unknown", "future-tool-kind"]) {
      const permissionRequest = { kind };
      const request = {
        stamp,
        provider: ProviderDriverKind.make("cursor"),
        threadId: "thread-1" as never,
        turnId: TurnId.make("turn-1"),
        requestId: RuntimeRequestId.make(`request-${kind}`),
        permissionRequest,
      };

      expect(
        makeAcpRequestOpenedEvent({
          ...request,
          detail: kind,
          args: {},
          source: "acp.jsonrpc",
          method: "session/request_permission",
          rawPayload: { sessionId: "session-1" },
        }),
      ).toMatchObject({
        type: "request.opened",
        payload: { requestType: "dynamic_tool_call" },
      });

      expect(
        makeAcpRequestResolvedEvent({
          ...request,
          decision: "accept",
        }),
      ).toMatchObject({
        type: "request.resolved",
        payload: { requestType: "dynamic_tool_call" },
      });
    }
  });

  it("maps ACP core plan, tool-call, and content updates", () => {
    const stamp = { eventId: "event-1" as never, createdAt: "2026-03-27T00:00:00.000Z" };
    const turnId = TurnId.make("turn-1");

    expect(
      makeAcpPlanUpdatedEvent({
        stamp,
        provider: ProviderDriverKind.make("cursor"),
        threadId: "thread-1" as never,
        turnId,
        payload: {
          plan: [{ step: "Inspect state", status: "inProgress" }],
        },
        source: "acp.cursor.extension",
        method: "cursor/update_todos",
        rawPayload: { todos: [] },
      }),
    ).toMatchObject({
      type: "turn.plan.updated",
      raw: {
        method: "cursor/update_todos",
      },
    });

    expect(
      makeAcpToolCallEvent({
        stamp,
        provider: ProviderDriverKind.make("cursor"),
        threadId: "thread-1" as never,
        turnId,
        toolCall: {
          toolCallId: "tool-1",
          kind: "execute",
          status: "completed",
          title: "Terminal",
          detail: "bun run test",
          data: { command: "bun run test" },
        },
        rawPayload: { sessionId: "session-1" },
      }),
    ).toMatchObject({
      type: "item.completed",
      payload: {
        itemType: "command_execution",
        status: "completed",
      },
    });

    expect(
      makeAcpContentDeltaEvent({
        stamp,
        provider: ProviderDriverKind.make("cursor"),
        threadId: "thread-1" as never,
        turnId,
        itemId: "assistant:session-1:segment:0",
        text: "hello",
        rawPayload: { sessionId: "session-1" },
      }),
    ).toMatchObject({
      type: "content.delta",
      itemId: "assistant:session-1:segment:0",
      payload: {
        delta: "hello",
      },
    });

    expect(
      makeAcpAssistantItemEvent({
        stamp,
        provider: ProviderDriverKind.make("cursor"),
        threadId: "thread-1" as never,
        turnId,
        itemId: "assistant:session-1:segment:0",
        lifecycle: "item.started",
      }),
    ).toMatchObject({
      type: "item.started",
      itemId: "assistant:session-1:segment:0",
      payload: {
        itemType: "assistant_message",
        status: "inProgress",
      },
    });
  });
});

describe("makeAcpTokenUsageEvent", () => {
  const stamp = { eventId: "event-usage" as never, createdAt: "2026-03-27T00:00:00.000Z" };
  const base = {
    stamp,
    provider: ProviderDriverKind.make("gemini"),
    threadId: "thread-1" as never,
    turnId: TurnId.make("turn-1"),
  };

  it("maps every field ACP defines", () => {
    const event = makeAcpTokenUsageEvent({
      ...base,
      usage: {
        inputTokens: 100,
        outputTokens: 20,
        totalTokens: 175,
        cachedReadTokens: 50,
        thoughtTokens: 5,
      },
    });

    expect(event.type).toBe("thread.token-usage.updated");
    expect(event.payload).toEqual({
      usage: {
        usedTokens: 175,
        totalProcessedTokens: 175,
        inputTokens: 100,
        outputTokens: 20,
        cachedInputTokens: 50,
        reasoningOutputTokens: 5,
      },
    });
  });

  it("omits optional counts the agent did not report", () => {
    // Absent must stay absent: the report renders a missing count as an em
    // dash, and a defaulted 0 would claim the agent reported zero.
    const event = makeAcpTokenUsageEvent({
      ...base,
      usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
    });

    expect(event.payload).toEqual({
      usage: {
        usedTokens: 14,
        totalProcessedTokens: 14,
        inputTokens: 10,
        outputTokens: 4,
      },
    });
  });

  it("treats null optional counts as unreported", () => {
    const event = makeAcpTokenUsageEvent({
      ...base,
      usage: {
        inputTokens: 10,
        outputTokens: 4,
        totalTokens: 14,
        cachedReadTokens: null,
        thoughtTokens: null,
      },
    });

    expect(event.payload).toEqual({
      usage: {
        usedTokens: 14,
        totalProcessedTokens: 14,
        inputTokens: 10,
        outputTokens: 4,
      },
    });
  });

  it("never reports a context window size", () => {
    // ACP has no field for it, and a fabricated maximum would make the meter
    // show a confident percentage against a number no agent supplied.
    const event = makeAcpTokenUsageEvent({
      ...base,
      usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
    });

    const usage = (event.payload as { readonly usage: Record<string, unknown> }).usage;
    expect("maxTokens" in usage).toBe(false);
  });
});
