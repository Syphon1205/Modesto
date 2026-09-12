import { scopeProjectRef } from "@modesto/client-runtime/environment";
import {
  DEFAULT_PROVIDER_INTERACTION_MODE,
  DEFAULT_RUNTIME_MODE,
  EnvironmentId,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
} from "@modesto/contracts";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  attachedThreadConversationMode,
  attachedThreadCopy,
  buildNestedChatThreadCreateInput,
  NESTED_CHAT_THREAD_TITLE,
  resolveThreadActionProjectRef,
  resolveNewDraftStartFromOrigin,
  startNewThreadFromContext,
  type ChatThreadActionContext,
} from "./chatThreadActions";

const ENVIRONMENT_ID = EnvironmentId.make("environment-1");
const PROJECT_ID = ProjectId.make("project-1");
const FALLBACK_PROJECT_ID = ProjectId.make("project-2");

function createContext(overrides: Partial<ChatThreadActionContext> = {}): ChatThreadActionContext {
  return {
    activeDraftThread: null,
    activeThread: undefined,
    defaultProjectRef: scopeProjectRef(ENVIRONMENT_ID, FALLBACK_PROJECT_ID),
    handleNewThread: async () => {},
    ...overrides,
  };
}

describe("chatThreadActions", () => {
  it("only applies the start-from-origin default to new worktree drafts", () => {
    expect(
      resolveNewDraftStartFromOrigin({
        envMode: "worktree",
        newWorktreesStartFromOrigin: true,
      }),
    ).toBe(true);
    expect(
      resolveNewDraftStartFromOrigin({
        envMode: "local",
        newWorktreesStartFromOrigin: true,
      }),
    ).toBe(false);
  });

  it("prefers the active thread project when resolving thread actions", () => {
    const projectRef = resolveThreadActionProjectRef(
      createContext({
        activeThread: {
          environmentId: ENVIRONMENT_ID,
          projectId: PROJECT_ID,
        },
      }),
    );

    expect(projectRef).toEqual(scopeProjectRef(ENVIRONMENT_ID, PROJECT_ID));
  });

  it("falls back to the active draft thread project when there is no active thread", () => {
    const projectRef = resolveThreadActionProjectRef(
      createContext({
        activeDraftThread: {
          environmentId: ENVIRONMENT_ID,
          projectId: PROJECT_ID,
        },
      }),
    );

    expect(projectRef).toEqual(scopeProjectRef(ENVIRONMENT_ID, PROJECT_ID));
  });

  it("falls back to the default project ref when there is no active thread context", () => {
    const projectRef = resolveThreadActionProjectRef(
      createContext({
        defaultProjectRef: scopeProjectRef(ENVIRONMENT_ID, PROJECT_ID),
      }),
    );

    expect(projectRef).toEqual(scopeProjectRef(ENVIRONMENT_ID, PROJECT_ID));
  });

  it("inherits only the project from context, never branch or worktree state", async () => {
    const handleNewThread = vi.fn<ChatThreadActionContext["handleNewThread"]>(async () => {});

    const didStart = await startNewThreadFromContext(
      createContext({
        activeThread: {
          environmentId: ENVIRONMENT_ID,
          projectId: PROJECT_ID,
        },
        handleNewThread,
      }),
    );

    expect(didStart).toBe(true);
    expect(handleNewThread).toHaveBeenCalledWith(
      scopeProjectRef(ENVIRONMENT_ID, PROJECT_ID),
      undefined,
    );
  });

  it("does not start a work thread when there is no project context", async () => {
    const handleNewThread = vi.fn<ChatThreadActionContext["handleNewThread"]>(async () => {});

    const didStart = await startNewThreadFromContext(
      createContext({
        defaultProjectRef: null,
        unscopedChatProjectRef: scopeProjectRef(ENVIRONMENT_ID, ProjectId.make("unscoped-chat")),
        handleNewThread,
      }),
    );

    expect(didStart).toBe(false);
    expect(handleNewThread).not.toHaveBeenCalled();
  });

  it("starts an unscoped chat when there is no project context", async () => {
    const handleNewThread = vi.fn<ChatThreadActionContext["handleNewThread"]>(async () => {});
    const unscopedChatProjectRef = scopeProjectRef(ENVIRONMENT_ID, ProjectId.make("unscoped-chat"));

    const didStart = await startNewThreadFromContext(
      createContext({
        defaultProjectRef: null,
        unscopedChatProjectRef,
        handleNewThread,
      }),
      { conversationMode: "chat" },
    );

    expect(didStart).toBe(true);
    expect(handleNewThread).toHaveBeenCalledWith(unscopedChatProjectRef, {
      conversationMode: "chat",
    });
  });

  it("builds a chat nested under the parent chat", () => {
    const parentId = ThreadId.make("thread-chat");
    const nextThreadId = ThreadId.make("thread-nested");
    const createdAt = "2026-09-08T15:00:00.000Z";
    expect(
      buildNestedChatThreadCreateInput(
        {
          id: parentId,
          projectId: PROJECT_ID,
          modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
          runtimeMode: DEFAULT_RUNTIME_MODE,
          branch: "main",
          worktreePath: "/tmp/worktree",
        },
        nextThreadId,
        createdAt,
      ),
    ).toEqual({
      threadId: nextThreadId,
      projectId: PROJECT_ID,
      title: NESTED_CHAT_THREAD_TITLE,
      modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
      runtimeMode: DEFAULT_RUNTIME_MODE,
      interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
      conversationMode: "chat",
      parentThreadId: parentId,
      branch: "main",
      worktreePath: "/tmp/worktree",
      createdAt,
    });
  });

  it("locks attached sidechats as chat and spawned work as code", () => {
    expect(attachedThreadConversationMode("side")).toBe("chat");
    expect(attachedThreadConversationMode("multiagent")).toBe("code");
    expect(attachedThreadConversationMode("code-task")).toBe("code");
    expect(attachedThreadCopy("code-task").emptyTitle).toBe(NESTED_CHAT_THREAD_TITLE);
    expect(attachedThreadCopy("side").successTitle).toBe("Started a sidechat");
    expect(attachedThreadCopy("multiagent").emptyTitle).toBe("Multi-Agent");
    expect(attachedThreadCopy("multiagent").successTitle).toBe("Started multi-agent");
  });
});
