import { scopeProjectRef } from "@modesto/client-runtime/environment";
import {
  DEFAULT_PROVIDER_INTERACTION_MODE,
  type EnvironmentId,
  ProjectId,
  type ModelSelection,
  type ProviderInteractionMode,
  type RuntimeMode,
  type ScopedProjectRef,
  type ThreadId,
} from "@modesto/contracts";
import type { ConversationMode, DraftThreadEnvMode } from "../composerDraftStore";

interface ThreadContextLike {
  environmentId: EnvironmentId;
  projectId: ProjectId;
}

interface NewThreadHandler {
  (
    projectRef: ScopedProjectRef,
    options?: {
      branch?: string | null;
      worktreePath?: string | null;
      envMode?: DraftThreadEnvMode;
      startFromOrigin?: boolean;
      conversationMode?: ConversationMode;
    },
    // The opened draft's identity, which most callers have no use for.
  ): Promise<unknown>;
}

export const UNSCOPED_CHAT_PROJECT_ID = ProjectId.make("unscoped-chat");

export function unscopedChatProjectRef(environmentId: EnvironmentId): ScopedProjectRef {
  return scopeProjectRef(environmentId, UNSCOPED_CHAT_PROJECT_ID);
}

export interface ChatThreadActionContext {
  readonly activeDraftThread: ThreadContextLike | null;
  readonly activeThread: ThreadContextLike | undefined;
  readonly defaultProjectRef: ScopedProjectRef | null;
  readonly unscopedChatProjectRef?: ScopedProjectRef | null;
  readonly handleNewThread: NewThreadHandler;
}

export function resolveNewDraftStartFromOrigin(input: {
  envMode: DraftThreadEnvMode;
  newWorktreesStartFromOrigin: boolean;
}): boolean {
  return input.envMode === "worktree" && input.newWorktreesStartFromOrigin;
}

export function resolveThreadActionProjectRef(
  context: ChatThreadActionContext,
): ScopedProjectRef | null {
  if (context.activeThread) {
    return scopeProjectRef(context.activeThread.environmentId, context.activeThread.projectId);
  }
  if (context.activeDraftThread) {
    return scopeProjectRef(
      context.activeDraftThread.environmentId,
      context.activeDraftThread.projectId,
    );
  }
  return context.defaultProjectRef;
}

// New threads inherit only the *project* from the current context. Branch,
// worktree, and env mode always come from the user's configured defaults —
// carrying them over from the viewed thread meant "new thread" silently
// reused checkouts and branches. Explicit affordances (branch toolbar's
// "new thread in this worktree") pass those options to handleNewThread
// directly instead.
export async function startNewThreadFromContext(
  context: ChatThreadActionContext,
  options?: { readonly conversationMode?: ConversationMode },
): Promise<boolean> {
  const projectRef =
    resolveThreadActionProjectRef(context) ??
    (options?.conversationMode === "chat" ? (context.unscopedChatProjectRef ?? null) : null);
  if (!projectRef) {
    return false;
  }

  await context.handleNewThread(projectRef, options);
  return true;
}

export const NESTED_CHAT_THREAD_TITLE = "New thread";

export interface NestedChatThreadParent {
  readonly id: ThreadId;
  readonly projectId: ProjectId;
  readonly modelSelection: ModelSelection;
  readonly runtimeMode: RuntimeMode;
  readonly interactionMode?: ProviderInteractionMode;
  readonly branch: string | null;
  readonly worktreePath: string | null;
}

/**
 * Create payload for a chat nested under another chat. Coding work still
 * starts a code/project thread when the user asks the model for it.
 */
export function buildNestedChatThreadCreateInput(
  parent: NestedChatThreadParent,
  threadId: ThreadId,
  createdAt: string,
) {
  return {
    threadId,
    projectId: parent.projectId,
    title: NESTED_CHAT_THREAD_TITLE,
    modelSelection: parent.modelSelection,
    runtimeMode: parent.runtimeMode,
    interactionMode: parent.interactionMode ?? DEFAULT_PROVIDER_INTERACTION_MODE,
    conversationMode: "chat" as const,
    parentThreadId: parent.id,
    branch: parent.branch,
    worktreePath: parent.worktreePath,
    createdAt,
  };
}

export type AttachedThreadKind = "side" | "multiagent" | "code-task";

export function attachedThreadConversationMode(kind: AttachedThreadKind): ConversationMode {
  return kind === "side" ? "chat" : "code";
}

export function attachedThreadCopy(kind: AttachedThreadKind): {
  readonly emptyTitle: string;
  readonly failureTitle: string;
  readonly successTitle: string;
} {
  switch (kind) {
    case "side":
      return {
        emptyTitle: "Sidechat",
        failureTitle: "Could not start sidechat",
        successTitle: "Started a sidechat",
      };
    case "code-task":
      return {
        emptyTitle: NESTED_CHAT_THREAD_TITLE,
        failureTitle: "Could not start thread",
        successTitle: "Started a thread",
      };
    default:
      return {
        emptyTitle: "Multi-Agent",
        failureTitle: "Could not spawn multi-agent",
        successTitle: "Started multi-agent",
      };
  }
}
