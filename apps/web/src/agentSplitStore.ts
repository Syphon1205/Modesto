import type { EnvironmentId, ThreadId } from "@modesto/contracts";
import { create } from "zustand";

import {
  MAX_AGENT_SPLIT_PANES,
  agentSplitParentKey,
  type AgentSplitPaneRef,
  parentScopedThreadRef,
} from "./agentSplit";

type AgentSplitSession = {
  readonly parentEnvironmentId: EnvironmentId;
  readonly parentThreadId: ThreadId;
  readonly panes: ReadonlyArray<AgentSplitPaneRef>;
};

type AgentSplitState = {
  readonly splitByParentKey: Readonly<Record<string, AgentSplitSession>>;
  readonly dismissedOfferByParentKey: Readonly<Record<string, true>>;
  openSplit: (input: {
    readonly parentEnvironmentId: EnvironmentId;
    readonly parentThreadId: ThreadId;
    readonly panes: ReadonlyArray<AgentSplitPaneRef>;
  }) => void;
  closeSplit: (parentEnvironmentId: EnvironmentId, parentThreadId: ThreadId) => void;
  dismissOffer: (parentEnvironmentId: EnvironmentId, parentThreadId: ThreadId) => void;
  clearDismissedOffer: (parentEnvironmentId: EnvironmentId, parentThreadId: ThreadId) => void;
};

export const useAgentSplitStore = create<AgentSplitState>((set) => ({
  splitByParentKey: {},
  dismissedOfferByParentKey: {},
  openSplit: ({ parentEnvironmentId, parentThreadId, panes }) => {
    const key = agentSplitParentKey(parentScopedThreadRef(parentEnvironmentId, parentThreadId));
    const nextPanes = panes.slice(0, MAX_AGENT_SPLIT_PANES);
    if (nextPanes.length === 0) return;
    set((state) => {
      const { [key]: _dismissed, ...restDismissed } = state.dismissedOfferByParentKey;
      return {
        splitByParentKey: {
          ...state.splitByParentKey,
          [key]: {
            parentEnvironmentId,
            parentThreadId,
            panes: nextPanes,
          },
        },
        dismissedOfferByParentKey: restDismissed,
      };
    });
  },
  closeSplit: (parentEnvironmentId, parentThreadId) => {
    const key = agentSplitParentKey(parentScopedThreadRef(parentEnvironmentId, parentThreadId));
    set((state) => {
      const { [key]: _removed, ...rest } = state.splitByParentKey;
      return { splitByParentKey: rest };
    });
  },
  dismissOffer: (parentEnvironmentId, parentThreadId) => {
    const key = agentSplitParentKey(parentScopedThreadRef(parentEnvironmentId, parentThreadId));
    set((state) => ({
      dismissedOfferByParentKey: {
        ...state.dismissedOfferByParentKey,
        [key]: true,
      },
    }));
  },
  clearDismissedOffer: (parentEnvironmentId, parentThreadId) => {
    const key = agentSplitParentKey(parentScopedThreadRef(parentEnvironmentId, parentThreadId));
    set((state) => {
      const { [key]: _removed, ...rest } = state.dismissedOfferByParentKey;
      return { dismissedOfferByParentKey: rest };
    });
  },
}));

export function selectAgentSplitForParent(
  state: AgentSplitState,
  parentEnvironmentId: EnvironmentId,
  parentThreadId: ThreadId,
): AgentSplitSession | null {
  const key = agentSplitParentKey(parentScopedThreadRef(parentEnvironmentId, parentThreadId));
  return state.splitByParentKey[key] ?? null;
}

export function selectAgentSplitOfferDismissed(
  state: AgentSplitState,
  parentEnvironmentId: EnvironmentId,
  parentThreadId: ThreadId,
): boolean {
  const key = agentSplitParentKey(parentScopedThreadRef(parentEnvironmentId, parentThreadId));
  return state.dismissedOfferByParentKey[key] === true;
}
