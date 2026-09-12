/**
 * Zustand store holding the chat tab strip, persisted to localStorage.
 *
 * All the interesting rules live in `chatTabs.ts` as pure functions; this file
 * only owns "where it is kept" and "when it is written". Writes are debounced
 * because opening a tab is a per-navigation event and localStorage is
 * synchronous - the same treatment `uiStateStore.ts` gives its own writes.
 */
import { create } from "zustand";

import {
  activateChatTab,
  type ChatTab,
  type ChatTabsState,
  type ChatThreadTab,
  chatTabKey,
  closeChatTab,
  closeChatTabsToTheRight,
  closeOtherChatTabs,
  EMPTY_CHAT_TABS,
  openChatTab,
  pruneChatTabs,
  reorderChatTab,
  sanitizeChatTabs,
  setChatTabGroupColor,
  withAssignedGroupColors,
} from "./chatTabs";

const PERSISTED_CHAT_TABS_KEY = "modesto:chat-tabs";
const PERSIST_DEBOUNCE_MS = 500;

function readPersistedChatTabs(): ChatTabsState {
  if (typeof window === "undefined") {
    return EMPTY_CHAT_TABS;
  }
  try {
    const raw = window.localStorage.getItem(PERSISTED_CHAT_TABS_KEY);
    return raw ? sanitizeChatTabs(JSON.parse(raw)) : EMPTY_CHAT_TABS;
  } catch {
    // Corrupt or unreadable storage must not stop the app from booting.
    return EMPTY_CHAT_TABS;
  }
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;

function persistChatTabs(state: ChatTabsState): void {
  if (typeof window === "undefined") {
    return;
  }
  if (persistTimer !== undefined) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(PERSISTED_CHAT_TABS_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota/storage errors, same as the rest of the UI state.
    }
  }, PERSIST_DEBOUNCE_MS);
}

interface ChatTabsStore extends ChatTabsState {
  readonly openTab: (tab: ChatTab) => void;
  readonly closeTab: (key: string) => void;
  readonly closeOthers: (key: string) => void;
  /** `displayedKeys` is the grouped, on-screen order - see `closeChatTabsToTheRight`. */
  readonly closeToTheRight: (key: string, displayedKeys: ReadonlyArray<string>) => void;
  /** Moves `key` before `beforeKey`; `null` moves it to the end. */
  readonly reorderTab: (key: string, beforeKey: string | null) => void;
  readonly activateTab: (key: string) => void;
  readonly pruneTabs: (isKnownThread: (tab: ChatThreadTab) => boolean) => void;
  /** Sets a group's color; `null` clears it and restores the auto-assigned one. */
  readonly setGroupColor: (key: string, color: string | null) => void;
  /** Assigns colors to any groups that lack one. Called by the strip once it
   *  knows which groups are on screen, since groups come from live project
   *  state that this store deliberately does not depend on. */
  readonly ensureGroupColors: (groupKeys: ReadonlyArray<string>) => void;
}

export const useChatTabsStore = create<ChatTabsStore>((set, get) => {
  const apply = (next: ChatTabsState) => {
    const current = get();
    if (
      next.tabs === current.tabs &&
      next.activeKey === current.activeKey &&
      next.colors === current.colors
    ) {
      return;
    }
    set({ tabs: next.tabs, colors: next.colors, activeKey: next.activeKey });
    persistChatTabs(next);
  };

  return {
    ...readPersistedChatTabs(),
    openTab: (tab) => apply(openChatTab(get(), tab)),
    closeTab: (key) => apply(closeChatTab(get(), key)),
    closeOthers: (key) => apply(closeOtherChatTabs(get(), key)),
    closeToTheRight: (key, displayedKeys) =>
      apply(closeChatTabsToTheRight(get(), key, displayedKeys)),
    reorderTab: (key, beforeKey) => apply(reorderChatTab(get(), key, beforeKey)),
    activateTab: (key) => apply(activateChatTab(get(), key)),
    pruneTabs: (isKnownThread) => apply(pruneChatTabs(get(), isKnownThread)),
    setGroupColor: (key, color) => apply(setChatTabGroupColor(get(), key, color)),
    ensureGroupColors: (groupKeys) => {
      const current = get();
      const colors = withAssignedGroupColors(current.colors, groupKeys);
      if (colors === current.colors) return;
      apply({ ...current, colors });
    },
  };
});

export { chatTabKey };
export type { ChatTab, ChatTabsState, ChatThreadTab };
