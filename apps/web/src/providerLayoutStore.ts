import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ConversationMode } from "./composerDraftStore";
import { resolveStorage } from "./lib/storage";

/**
 * Claude Code desktop splits its sidebar into Chat and Code tabs. The tab
 * filters the session list and decides what a new session is, so the sidebar
 * and the draft landing read the same persisted value.
 */
interface ProviderLayoutState {
  claudeSection: ConversationMode;
  setClaudeSection: (section: ConversationMode) => void;
}

export const useProviderLayoutStore = create<ProviderLayoutState>()(
  persist(
    (set) => ({
      claudeSection: "code",
      setClaudeSection: (claudeSection) => set({ claudeSection }),
    }),
    {
      name: "modesto:provider-layout:v1",
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      partialize: (state) => ({ claudeSection: state.claudeSection }),
    },
  ),
);
