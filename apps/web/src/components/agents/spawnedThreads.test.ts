import { ThreadId } from "@modesto/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  isAttachedSidechat,
  selectSpawnedThreadsForParent,
  spawnedThreadIsLive,
  spawnedThreadKind,
  spawnedThreadRoleLabel,
  spawnedThreadStatusLabel,
} from "./spawnedThreads";

const parentId = ThreadId.make("thread-parent");
const otherParentId = ThreadId.make("thread-other");

function thread(
  overrides: Partial<{
    id: string;
    title: string;
    parentThreadId: string | null;
    conversationMode: "chat" | "code";
    archivedAt: string | null;
    deletedAt: string | null;
    latestTurnState: "running" | "completed" | "error" | "interrupted" | null;
    createdAt: string;
  }>,
) {
  const latestTurnState = overrides.latestTurnState ?? null;
  return {
    id: ThreadId.make(overrides.id ?? "thread-child"),
    title: overrides.title ?? "Child",
    parentThreadId: overrides.parentThreadId
      ? ThreadId.make(overrides.parentThreadId)
      : overrides.parentThreadId === null
        ? null
        : parentId,
    conversationMode: overrides.conversationMode ?? "code",
    archivedAt: overrides.archivedAt ?? null,
    deletedAt: overrides.deletedAt ?? null,
    latestTurn:
      latestTurnState === null
        ? null
        : {
            turnId: "turn-1" as never,
            state: latestTurnState,
            requestedAt: "2026-09-07T12:00:00.000Z",
            startedAt: "2026-09-07T12:00:00.000Z",
            completedAt: latestTurnState === "running" ? null : "2026-09-07T12:01:00.000Z",
            assistantMessageId: null,
          },
    createdAt: overrides.createdAt ?? "2026-09-07T12:00:00.000Z",
  };
}

describe("selectSpawnedThreadsForParent", () => {
  it("includes sidechats and multiagent children of the current thread", () => {
    const side = thread({
      id: "thread-side",
      conversationMode: "chat",
      createdAt: "2026-09-07T12:01:00.000Z",
    });
    const multiagent = thread({
      id: "thread-multi",
      conversationMode: "code",
      createdAt: "2026-09-07T12:00:00.000Z",
    });
    const other = thread({
      id: "thread-other-child",
      parentThreadId: otherParentId,
    });
    const topLevel = thread({
      id: "thread-top",
      parentThreadId: null,
    });

    expect(
      selectSpawnedThreadsForParent([side, multiagent, other, topLevel], parentId).map(
        (entry) => entry.id,
      ),
    ).toEqual(["thread-multi", "thread-side"]);
  });

  it("excludes archived and deleted children", () => {
    const archived = thread({ id: "thread-archived", archivedAt: "2026-09-07T13:00:00.000Z" });
    const deleted = thread({ id: "thread-deleted", deletedAt: "2026-09-07T13:00:00.000Z" });
    const live = thread({ id: "thread-live" });

    expect(
      selectSpawnedThreadsForParent([archived, deleted, live], parentId).map((entry) => entry.id),
    ).toEqual(["thread-live"]);
  });
});

describe("spawned thread presentation", () => {
  it("classifies chat children as sidechats and code children as multiagent", () => {
    expect(spawnedThreadKind(thread({ conversationMode: "chat" }))).toBe("side");
    expect(spawnedThreadKind(thread({ conversationMode: "code" }))).toBe("multiagent");
    expect(spawnedThreadRoleLabel("side")).toBe("Sidechat");
    expect(spawnedThreadRoleLabel("multiagent")).toBe("Multi-Agent");
    expect(isAttachedSidechat(thread({ conversationMode: "chat" }))).toBe(true);
    expect(isAttachedSidechat(thread({ conversationMode: "code" }))).toBe(false);
    expect(isAttachedSidechat(thread({ parentThreadId: null, conversationMode: "chat" }))).toBe(
      false,
    );
  });

  it("maps latest-turn state to Agents-tab status", () => {
    expect(spawnedThreadIsLive(thread({ latestTurnState: "running" }))).toBe(true);
    expect(spawnedThreadStatusLabel(thread({ latestTurnState: "running" }))).toBe("Working");
    expect(spawnedThreadStatusLabel(thread({ latestTurnState: "completed" }))).toBe("Completed");
    expect(spawnedThreadStatusLabel(thread({ latestTurnState: "error" }))).toBe("Failed");
    expect(spawnedThreadStatusLabel(thread({ latestTurnState: null }))).toBe("Ready");
  });
});
