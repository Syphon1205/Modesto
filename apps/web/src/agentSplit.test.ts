import { EnvironmentId, ThreadId } from "@modesto/contracts";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  MAX_AGENT_SPLIT_PANES,
  agentSplitGridClassName,
  selectMultiagentSplitPanes,
  shouldOfferAgentSplitView,
  toAgentSplitPaneRefs,
} from "./agentSplit";
import {
  selectAgentSplitForParent,
  selectAgentSplitOfferDismissed,
  useAgentSplitStore,
} from "./agentSplitStore";

const parentId = ThreadId.make("thread-parent");
const envId = EnvironmentId.make("env-1");

function thread(
  overrides: Partial<{
    id: string;
    title: string;
    parentThreadId: string | null;
    conversationMode: "chat" | "code";
    createdAt: string;
  }>,
) {
  return {
    id: ThreadId.make(overrides.id ?? "thread-child"),
    title: overrides.title ?? "Child",
    parentThreadId:
      overrides.parentThreadId === undefined
        ? parentId
        : overrides.parentThreadId === null
          ? null
          : ThreadId.make(overrides.parentThreadId),
    conversationMode: overrides.conversationMode ?? "code",
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("selectMultiagentSplitPanes", () => {
  it("keeps only multiagent children, oldest first, capped at 4", () => {
    const panes = selectMultiagentSplitPanes(
      [
        thread({ id: "side", conversationMode: "chat", createdAt: "2026-01-01T00:00:01.000Z" }),
        thread({ id: "a", title: "A", createdAt: "2026-01-01T00:00:02.000Z" }),
        thread({ id: "b", title: "B", createdAt: "2026-01-01T00:00:03.000Z" }),
        thread({ id: "c", title: "C", createdAt: "2026-01-01T00:00:04.000Z" }),
        thread({ id: "d", title: "D", createdAt: "2026-01-01T00:00:05.000Z" }),
        thread({ id: "e", title: "E", createdAt: "2026-01-01T00:00:06.000Z" }),
        thread({
          id: "other",
          parentThreadId: "thread-other",
          createdAt: "2026-01-01T00:00:00.000Z",
        }),
      ],
      parentId,
    );

    expect(panes.map((pane) => pane.id)).toEqual([
      ThreadId.make("a"),
      ThreadId.make("b"),
      ThreadId.make("c"),
      ThreadId.make("d"),
    ]);
    expect(panes).toHaveLength(MAX_AGENT_SPLIT_PANES);
  });
});

describe("shouldOfferAgentSplitView", () => {
  it("offers starting at the second multiagent child", () => {
    expect(shouldOfferAgentSplitView(0)).toBe(false);
    expect(shouldOfferAgentSplitView(1)).toBe(false);
    expect(shouldOfferAgentSplitView(2)).toBe(true);
    expect(shouldOfferAgentSplitView(4)).toBe(true);
  });
});

describe("agentSplitGridClassName", () => {
  it("uses equal columns for 1–3 and a 2×2 for 4", () => {
    expect(agentSplitGridClassName(1)).toBe("grid-cols-1 grid-rows-1");
    expect(agentSplitGridClassName(2)).toBe("grid-cols-2 grid-rows-1");
    expect(agentSplitGridClassName(3)).toBe("grid-cols-3 grid-rows-1");
    expect(agentSplitGridClassName(4)).toBe("grid-cols-2 grid-rows-2");
  });
});

describe("toAgentSplitPaneRefs", () => {
  it("falls back to the parent environment id", () => {
    expect(toAgentSplitPaneRefs([thread({ id: "a", title: "Agent A" })], envId)).toEqual([
      {
        environmentId: envId,
        threadId: ThreadId.make("a"),
        title: "Agent A",
      },
    ]);
  });
});

describe("useAgentSplitStore", () => {
  beforeEach(() => {
    useAgentSplitStore.setState({
      splitByParentKey: {},
      dismissedOfferByParentKey: {},
    });
  });

  it("opens, caps panes, and clears a dismissed offer", () => {
    const panes = toAgentSplitPaneRefs(
      [
        thread({ id: "a", title: "A" }),
        thread({ id: "b", title: "B" }),
        thread({ id: "c", title: "C" }),
        thread({ id: "d", title: "D" }),
        thread({ id: "e", title: "E" }),
      ],
      envId,
    );
    useAgentSplitStore.getState().dismissOffer(envId, parentId);
    expect(selectAgentSplitOfferDismissed(useAgentSplitStore.getState(), envId, parentId)).toBe(
      true,
    );

    useAgentSplitStore.getState().openSplit({
      parentEnvironmentId: envId,
      parentThreadId: parentId,
      panes,
    });

    const session = selectAgentSplitForParent(useAgentSplitStore.getState(), envId, parentId);
    expect(session?.panes).toHaveLength(4);
    expect(session?.panes.map((pane) => pane.threadId)).toEqual([
      ThreadId.make("a"),
      ThreadId.make("b"),
      ThreadId.make("c"),
      ThreadId.make("d"),
    ]);
    expect(selectAgentSplitOfferDismissed(useAgentSplitStore.getState(), envId, parentId)).toBe(
      false,
    );
  });

  it("closes an open split without clearing dismiss state", () => {
    useAgentSplitStore.getState().openSplit({
      parentEnvironmentId: envId,
      parentThreadId: parentId,
      panes: toAgentSplitPaneRefs([thread({ id: "a" }), thread({ id: "b" })], envId),
    });
    useAgentSplitStore.getState().dismissOffer(envId, parentId);
    useAgentSplitStore.getState().closeSplit(envId, parentId);

    expect(selectAgentSplitForParent(useAgentSplitStore.getState(), envId, parentId)).toBeNull();
    expect(selectAgentSplitOfferDismissed(useAgentSplitStore.getState(), envId, parentId)).toBe(
      true,
    );
  });
});
