// FILE: useChatTabNavigation.ts
// Purpose: The single place that turns a tab action into a route change.
// Layer: Chat UI hook
//
// Both the strip's own controls and the `tab.new` / `tab.close` keybindings
// need identical behavior, and the first cut had them implemented separately -
// which immediately produced a real bug: the x button closed the active tab
// without navigating, leaving the user looking at a thread that no longer had
// a tab. Keeping one implementation is what stops that class of drift.
//
// Deliberately does NOT own "new tab": creating a thread means creating a
// draft *session*, not just routing to a fresh draft id - `/draft/<id>` with
// no session behind it bounces straight back to `/`. Callers pass the app's
// real new-thread action instead of this hook inventing a second one.

import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { type ChatTab, chatTabKey } from "../chatTabs";
import { useChatTabsStore } from "../chatTabsStore";

export interface ChatTabNavigation {
  /** Focus an open tab and route to it. */
  readonly activateTab: (tab: ChatTab) => void;
  /** Close a tab; routes to the next tab when the closed one was active. */
  readonly closeTab: (key: string) => void;
}

export function useChatTabNavigation(): ChatTabNavigation {
  const navigate = useNavigate();

  const goToTab = useCallback(
    (tab: ChatTab) => {
      if (tab.type === "draft") {
        void navigate({ to: "/draft/$draftId", params: { draftId: tab.draftId } });
        return;
      }
      void navigate({
        to: "/$environmentId/$threadId",
        params: { environmentId: tab.environmentId, threadId: tab.threadId },
      });
    },
    [navigate],
  );

  const closeTab = useCallback(
    (key: string) => {
      const wasActive = useChatTabsStore.getState().activeKey === key;
      useChatTabsStore.getState().closeTab(key);
      if (!wasActive) {
        // Closing a background tab must leave the current view alone.
        return;
      }
      const next = useChatTabsStore.getState();
      const fallback = next.tabs.find((tab) => chatTabKey(tab) === next.activeKey);
      if (fallback) {
        goToTab(fallback);
        return;
      }
      // Nothing left to show; the index route decides what an empty workspace
      // looks like rather than this hook guessing.
      void navigate({ to: "/" });
    },
    [goToTab, navigate],
  );

  return { activateTab: goToTab, closeTab };
}
