// FILE: agentThreadLinks.ts
// Purpose: Remember which bot started which thread, so the roster can show
//          what each agent is actually doing.
// Layer: Agents UI (state)
//
// The link is stored client-side and keyed by `environmentId:threadId`
// because a thread has no server-side notion of a bot yet. It is deliberately
// one-directional and lossy-tolerant: a thread whose link is missing is just
// an ordinary thread, and a link whose thread is gone is ignored on read. The
// roster degrading to "idle" is an acceptable failure; blocking on a link
// would not be.

import { create } from "zustand";

const STORAGE_KEY = "modesto:agent-thread-links:v1";

/** `environmentId:threadId` -> bot id. */
type LinkMap = Readonly<Record<string, string>>;

export function threadLinkKey(environmentId: string, threadId: string): string {
  return `${environmentId}:${threadId}`;
}

function readPersisted(): LinkMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const links: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string" && value.length > 0) links[key] = value;
    }
    return links;
  } catch {
    return {};
  }
}

function persist(links: LinkMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
  } catch {
    // Best-effort: the roster loses activity for this thread, nothing else.
  }
}

interface AgentThreadLinkState {
  readonly links: LinkMap;
  readonly linkThread: (environmentId: string, threadId: string, botId: string) => void;
  /** Forget every link belonging to a bot, for when it is deleted. */
  readonly forgetBot: (botId: string) => void;
}

export const useAgentThreadLinkStore = create<AgentThreadLinkState>()((set, get) => ({
  links: readPersisted(),
  linkThread: (environmentId, threadId, botId) => {
    const next = { ...get().links, [threadLinkKey(environmentId, threadId)]: botId };
    persist(next);
    set({ links: next });
  },
  forgetBot: (botId) => {
    const next = Object.fromEntries(
      Object.entries(get().links).filter(([, value]) => value !== botId),
    );
    persist(next);
    set({ links: next });
  },
}));

export function useAgentThreadLinks(): LinkMap {
  return useAgentThreadLinkStore((state) => state.links);
}

export function linkThreadToBot(environmentId: string, threadId: string, botId: string): void {
  useAgentThreadLinkStore.getState().linkThread(environmentId, threadId, botId);
}
