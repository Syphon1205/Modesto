// FILE: useKanbanBoard.ts
// Purpose: Subscribes to project/thread/composer state and derives the memoized kanban board.
// Layer: UI state hook (projection only - board math lives in kanban.logic.ts)
// Exports: useKanbanBoard
//
// Adapted from the original (pre-migration) Modesto's kanban hook. That version read a
// Zustand global store (useStore/useWorkspaceStore/useTerminalStateStore) this tree
// doesn't have; this one reads the same atom-backed state the sidebar already uses
// (useProjects/useThreadShells). Trimmed for the first working cut: no home-chat-container
// aliasing (this tree's projects are already flat, no synthetic "Chats" container) and no
// terminal-entry-thread detection yet (terminalEntryThreadIds defaults empty - every card
// renders with its provider glyph, never the terminal glyph, until that's wired).

import type { ThreadId } from "@modesto/contracts";
import { useMemo, useRef } from "react";

import { useComposerDraftStore } from "../../composerDraftStore";
import { useKanbanUiStore } from "../../kanbanUiStore";
import { useProjects, useThreadShells } from "../../state/entities";
import {
  areKanbanComposerDraftSnapshotsEqual,
  buildKanbanBoard,
  buildKanbanComposerDraftSnapshot,
  type KanbanBoard,
  type KanbanComposerDraftSnapshot,
  type KanbanDraftThreadSnapshot,
} from "./kanban.logic";

export function useKanbanBoard(): KanbanBoard {
  const projects = useProjects();
  const threads = useThreadShells();
  const draftsByThreadId = useComposerDraftStore((state) => state.draftsByThreadKey);
  const draftThreadsByThreadId = useComposerDraftStore((state) => state.draftThreadsByThreadKey);
  const draftOrderByProjectId = useKanbanUiStore((state) => state.draftOrderByProjectId);
  const optimisticDispatchByThreadId = useKanbanUiStore(
    (state) => state.optimisticDispatchByThreadId,
  );

  const activeThreads = useMemo(
    () => threads.filter((thread) => thread.archivedAt === null),
    [threads],
  );

  // Project composer drafts down to the few fields the board needs. Empty drafts
  // are dropped so routine composer churn (focus, selections, modes) rarely
  // changes the content, and the identity cache keeps the same object when it
  // doesn't, sparing the downstream board rebuild.
  const composerDraftCacheRef = useRef<Record<string, KanbanComposerDraftSnapshot>>({});
  const composerDraftByThreadId = useMemo(() => {
    const result: Record<string, KanbanComposerDraftSnapshot> = {};
    for (const [threadId, draft] of Object.entries(draftsByThreadId)) {
      const snapshot = buildKanbanComposerDraftSnapshot(draft);
      if (snapshot && (snapshot.prompt.trim().length > 0 || snapshot.hasAttachments)) {
        result[threadId] = snapshot;
      }
    }
    if (areKanbanComposerDraftSnapshotsEqual(composerDraftCacheRef.current, result)) {
      return composerDraftCacheRef.current;
    }
    composerDraftCacheRef.current = result;
    return result;
  }, [draftsByThreadId]);

  const draftThreads = useMemo(() => {
    const result: KanbanDraftThreadSnapshot[] = [];
    for (const [threadId, draftThread] of Object.entries(draftThreadsByThreadId)) {
      // Promoted drafts already surface through their durable thread.
      if (draftThread.promotedTo) {
        continue;
      }
      result.push({
        threadId: threadId as ThreadId,
        projectId: draftThread.projectId,
        createdAt: draftThread.createdAt,
        branch: draftThread.branch,
        worktreePath: draftThread.worktreePath,
      });
    }
    return result;
  }, [draftThreadsByThreadId]);

  return useMemo(
    () =>
      buildKanbanBoard({
        projects,
        threads: activeThreads,
        draftThreads,
        composerDraftByThreadId,
        draftOrderByProjectId,
        optimisticDispatchByThreadId,
      }),
    [
      projects,
      activeThreads,
      draftThreads,
      composerDraftByThreadId,
      draftOrderByProjectId,
      optimisticDispatchByThreadId,
    ],
  );
}
