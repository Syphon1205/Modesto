// FILE: coworkThreadStore.ts
// Purpose: Marks threads started from the Teams/Research task launchers so the chat
// window can render a simplified, permissions-free composer for them.
// Layer: UI state store
// Exports: useCoworkThreadStore

import { type ThreadId } from "@modesto/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface CoworkThreadStoreState {
  coworkThreadIds: ThreadId[];
  threadKindById: Record<string, CoworkThreadKind | undefined>;
  markCoworkThread: (threadId: ThreadId, kind: CoworkThreadKind) => void;
}

const COWORK_THREADS_STORAGE_KEY = "modesto:cowork-threads:v1";
/** Bounded so this list can't grow unboundedly across a long-lived session. */
const MAX_TRACKED_COWORK_THREADS = 500;

export type CoworkThreadKind = "research" | "teams";

export const useCoworkThreadStore = create<CoworkThreadStoreState>()(
  persist(
    (set) => ({
      coworkThreadIds: [],
      threadKindById: {},
      markCoworkThread: (threadId, kind) => {
        if (threadId.length === 0) return;
        set((state) => {
          if (state.coworkThreadIds.includes(threadId) && state.threadKindById[threadId] === kind) {
            return state;
          }
          const next = [
            ...state.coworkThreadIds.filter((candidate) => candidate !== threadId),
            threadId,
          ];
          const bounded =
            next.length > MAX_TRACKED_COWORK_THREADS
              ? next.slice(next.length - MAX_TRACKED_COWORK_THREADS)
              : next;
          const boundedSet = new Set<string>(bounded);
          const threadKindById = Object.fromEntries(
            Object.entries(state.threadKindById).filter(([candidate]) => boundedSet.has(candidate)),
          );
          threadKindById[threadId] = kind;
          return {
            coworkThreadIds: bounded,
            threadKindById,
          };
        });
      },
    }),
    {
      name: COWORK_THREADS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<CoworkThreadStoreState> | undefined;
        const coworkThreadIds = state?.coworkThreadIds ?? [];
        if (version >= 2) {
          return {
            ...state,
            coworkThreadIds,
            threadKindById: state?.threadKindById ?? {},
          } as CoworkThreadStoreState;
        }
        return {
          ...state,
          coworkThreadIds,
          threadKindById: Object.fromEntries(
            coworkThreadIds.map((threadId) => [threadId, "research"] as const),
          ),
        } as CoworkThreadStoreState;
      },
    },
  ),
);

export function isCoworkThreadId(
  coworkThreadIds: readonly ThreadId[],
  threadId: ThreadId | null | undefined,
): boolean {
  return Boolean(threadId) && coworkThreadIds.includes(threadId as ThreadId);
}

export function coworkThreadKind(
  threadKindById: Readonly<Record<string, CoworkThreadKind | undefined>>,
  threadId: ThreadId | null | undefined,
): CoworkThreadKind | null {
  return threadId ? (threadKindById[threadId] ?? null) : null;
}

export function isResearchThreadId(
  threadKindById: Readonly<Record<string, CoworkThreadKind | undefined>>,
  threadId: ThreadId | null | undefined,
): boolean {
  return coworkThreadKind(threadKindById, threadId) === "research";
}
