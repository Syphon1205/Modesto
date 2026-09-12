// FILE: agentBotStore.ts
// Purpose: The persisted agent-bot roster.
// Layer: Agents UI (state)
//
// Local-first on purpose, and behind a deliberately narrow surface. A bot is
// user-level configuration, not server state, so the roster lives in this
// client the way theme and ambient-presence settings do. When bots become
// server-backed, only the four mutators below change — every consumer reads
// through `useAgentBots`, so the swap does not reach the UI.

import { AgentBotRoster, type AgentBot, type AgentBotDraft } from "@modesto/contracts";
import { normalizeAvatarSpec } from "./avatar/agentAvatarRandom";
import { create } from "zustand";

import { applyAgentBotDraft, createAgentBot } from "./agentRoster";
import { getLocalStorageItem, setLocalStorageItem } from "../hooks/useLocalStorage";

export const AGENT_BOTS_STORAGE_KEY = "modesto:agent-bots:v1";

function readPersistedBots(): ReadonlyArray<AgentBot> {
  if (typeof window === "undefined") return [];
  try {
    const roster = getLocalStorageItem(AGENT_BOTS_STORAGE_KEY, AgentBotRoster);
    if (!roster) return [];
    // Re-normalise on read, not just on write: the avatar engine throws on a
    // definition its own validator rejects, and that exception takes out the
    // whole roster rather than one card — so a spec written by an older build
    // has to be repaired before it ever reaches the renderer.
    return roster.bots.map((bot) => ({ ...bot, avatar: normalizeAvatarSpec(bot.avatar) }));
  } catch (error) {
    console.error("Could not read the persisted agent roster.", error);
    return [];
  }
}

function persistBots(bots: ReadonlyArray<AgentBot>): void {
  if (typeof window === "undefined") return;
  try {
    setLocalStorageItem(AGENT_BOTS_STORAGE_KEY, { version: 1, bots }, AgentBotRoster);
  } catch (error) {
    console.error("Could not persist the agent roster.", error);
  }
}

interface AgentBotStoreState {
  readonly bots: ReadonlyArray<AgentBot>;
  readonly addBot: (draft: AgentBotDraft) => AgentBot;
  readonly updateBot: (id: string, draft: AgentBotDraft) => void;
  readonly setArchived: (id: string, archived: boolean) => void;
  readonly removeBot: (id: string) => void;
}

export const useAgentBotStore = create<AgentBotStoreState>()((set, get) => ({
  bots: readPersistedBots(),
  addBot: (draft) => {
    const bot = createAgentBot({ draft, existing: get().bots, now: Date.now() });
    const next = [...get().bots, bot];
    persistBots(next);
    set({ bots: next });
    return bot;
  },
  updateBot: (id, draft) => {
    const existing = get().bots;
    const next = existing.map((bot) =>
      bot.id === id ? applyAgentBotDraft(bot, draft, existing, Date.now()) : bot,
    );
    persistBots(next);
    set({ bots: next });
  },
  setArchived: (id, archived) => {
    const next = get().bots.map((bot) =>
      bot.id === id ? { ...bot, archived, updatedAt: Date.now() } : bot,
    );
    persistBots(next);
    set({ bots: next });
  },
  removeBot: (id) => {
    const next = get().bots.filter((bot) => bot.id !== id);
    persistBots(next);
    set({ bots: next });
  },
}));

export function useAgentBots(): ReadonlyArray<AgentBot> {
  return useAgentBotStore((state) => state.bots);
}

export function useAgentBot(id: string | undefined): AgentBot | undefined {
  return useAgentBotStore((state) =>
    id === undefined ? undefined : state.bots.find((bot) => bot.id === id),
  );
}

/** Whether the user has ever made a bot — drives the welcome step's done state. */
export function hasAnyAgentBot(): boolean {
  return useAgentBotStore.getState().bots.length > 0;
}
