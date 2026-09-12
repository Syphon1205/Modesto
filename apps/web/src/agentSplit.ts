import type { EnvironmentId, ThreadId, ScopedThreadRef } from "@modesto/contracts";
import { scopeThreadRef, scopedThreadKey } from "@modesto/client-runtime/environment";

import {
  selectSpawnedThreadsForParent,
  spawnedThreadKind,
  type SpawnedThreadLike,
} from "./components/agents/spawnedThreads";

/** Hard cap for equal agent split panes — matches terminal split group limit. */
export const MAX_AGENT_SPLIT_PANES = 4;

export type AgentSplitPaneRef = {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly title: string;
};

export function agentSplitParentKey(parentRef: ScopedThreadRef): string {
  return scopedThreadKey(parentRef);
}

/**
 * Multi-agent children of a parent, oldest first, capped at MAX_AGENT_SPLIT_PANES.
 * Equal-pane layout renders these left-to-right / reading order.
 */
export function selectMultiagentSplitPanes<T extends SpawnedThreadLike>(
  threads: ReadonlyArray<T>,
  parentThreadId: ThreadId,
): T[] {
  return selectSpawnedThreadsForParent(threads, parentThreadId)
    .filter((thread) => spawnedThreadKind(thread) === "multiagent")
    .slice(0, MAX_AGENT_SPLIT_PANES);
}

export function shouldOfferAgentSplitView(multiagentChildCount: number): boolean {
  return multiagentChildCount >= 2;
}

export function agentSplitGridClassName(paneCount: number): string {
  switch (paneCount) {
    case 1:
      return "grid-cols-1 grid-rows-1";
    case 2:
      return "grid-cols-2 grid-rows-1";
    case 3:
      return "grid-cols-3 grid-rows-1";
    default:
      // 4 panes: equal 2×2 so none are skinny columns
      return "grid-cols-2 grid-rows-2";
  }
}

export function toAgentSplitPaneRefs<
  T extends SpawnedThreadLike & { readonly environmentId?: EnvironmentId },
>(panes: ReadonlyArray<T>, fallbackEnvironmentId: EnvironmentId): AgentSplitPaneRef[] {
  return panes.map((pane) => ({
    environmentId: pane.environmentId ?? fallbackEnvironmentId,
    threadId: pane.id,
    title: pane.title,
  }));
}

export function parentScopedThreadRef(
  environmentId: EnvironmentId,
  threadId: ThreadId,
): ScopedThreadRef {
  return scopeThreadRef(environmentId, threadId);
}
