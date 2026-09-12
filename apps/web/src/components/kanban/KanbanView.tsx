// FILE: KanbanView.tsx
// Purpose: Kanban board page - one project's three columns, or an overview across all
//          projects when no project is selected.
// Layer: Route-level page component
// Exports: KanbanView (default)
//
// First working cut of Modesto's Tasks board on this tree: real project/thread data,
// real Draft/In Progress/Done derivation (kanban.logic.ts), click a card to open its
// thread. Drag-to-dispatch (dropping a Draft card onto In Progress to send its prompt)
// is not wired yet - that needs kanbanDispatch.ts's message-formatting pipeline
// (skills/mentions/attachments), which is substantial enough to land as its own pass
// rather than rushed. Cards are still fully interactive for browsing and opening.

import type { ScopedThreadRef } from "@modesto/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";

import { cn } from "../../lib/utils";
import { useProjects } from "../../state/entities";
import { KanbanColumn } from "./KanbanColumn";
import type { KanbanCard, KanbanProjectBoard } from "./kanban.logic";
import { KanbanTaskDetail } from "./KanbanTaskDetail";
import { TaskListView } from "./TaskListView";
import { useKanbanBoard } from "./useKanbanBoard";

/**
 * How a board is sized.
 *
 * The two views want opposite things, and conflating them is what made the
 * overview chaotic: every board was `flex-1` inside a scrolling column, so each
 * one fought to fill the viewport and a project with two empty columns still
 * reserved a full screen before the next project began.
 *
 * - `focused` - one project, fills the page. Columns scroll internally.
 * - `overview` - many projects stacked. Each board is capped and scrolls
 *   internally, so the page scrolls through *boards* rather than through one
 *   board's empty space.
 */
type KanbanBoardLayout = "focused" | "overview";

const OVERVIEW_CARD_CAP = 4;

function ProjectBoard({
  board,
  layout,
  onSelectCard,
}: {
  board: KanbanProjectBoard;
  layout: KanbanBoardLayout;
  onSelectCard: (card: KanbanCard) => void;
}) {
  const focused = layout === "focused";
  // Enough to see what a project is doing without one busy project pushing the
  // others off the page; "show more" opens the rest in place.
  const overviewCap = focused ? undefined : OVERVIEW_CARD_CAP;

  // Three columns of "Empty" says nothing a single line does not.
  if (!focused && board.totalCount === 0) {
    return (
      <section className="flex shrink-0 items-center gap-2 rounded-xl border border-border/60 bg-muted/[0.03] px-3 py-2">
        <h2 className="truncate text-sm font-medium text-foreground/70">{board.projectName}</h2>
        <span className="text-xs text-muted-foreground/70">No tasks</span>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "flex flex-col",
        // A bordered card per project, so two boards read as two things rather
        // than running together under floating headings. `shrink-0` in the
        // overview: the board is as tall as its cards, and the page scrolls.
        focused ? "min-h-0 flex-1" : "shrink-0 rounded-xl border border-border/60 bg-muted/[0.03]",
      )}
    >
      <header
        className={cn(
          "flex shrink-0 items-center gap-2",
          focused ? "px-1.5 pb-3" : "border-b border-border/60 px-3 py-2",
        )}
      >
        <h2 className="truncate text-sm font-medium text-foreground/90">{board.projectName}</h2>
        <span className="text-xs tabular-nums text-muted-foreground/70">{board.totalCount}</span>
      </header>
      <div
        className={cn(
          "flex gap-4 overflow-x-auto",
          focused && "min-h-0",
          // No pixel cap in the overview. Height is bounded by capping how many
          // cards each column renders, so a board always ends on a whole card
          // rather than slicing the last one in half.
          focused ? "flex-1 pb-2" : "p-3",
        )}
      >
        <KanbanColumn
          projectId={board.projectId}
          columnKey="draft"
          cards={board.draft}
          onOpenCard={onSelectCard}
          renderCap={overviewCap}
          scrollable={focused}
        />
        <KanbanColumn
          projectId={board.projectId}
          columnKey="inProgress"
          cards={board.inProgress}
          onOpenCard={onSelectCard}
          renderCap={overviewCap}
          scrollable={focused}
        />
        <KanbanColumn
          projectId={board.projectId}
          columnKey="done"
          cards={board.done}
          onOpenCard={onSelectCard}
          renderCap={overviewCap}
          scrollable={focused}
        />
      </div>
    </section>
  );
}

export default function KanbanView({ projectId }: { projectId: string | null }) {
  const board = useKanbanBoard();
  const allProjects = useProjects();
  const navigate = useNavigate();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Resolved from live board data rather than storing the card: a card that
  // finishes or is dispatched is rebuilt, and a stored copy would go stale.
  const selectedCard = useMemo(() => {
    if (selectedCardId === null) return null;
    for (const projectBoard of board.projects) {
      for (const card of [
        ...projectBoard.draft,
        ...projectBoard.inProgress,
        ...projectBoard.done,
      ]) {
        if (card.cardId === selectedCardId) return card;
      }
    }
    return null;
  }, [board.projects, selectedCardId]);

  const openThread = useCallback(
    (card: KanbanCard) => {
      if (card.thread) {
        void navigate({
          to: "/$environmentId/$threadId",
          params: {
            environmentId: card.thread.environmentId,
            threadId: card.threadId,
          } as ScopedThreadRef & { environmentId: string; threadId: string },
        });
        return;
      }
      // Local-only draft: threadId doubles as the draft's identity in this
      // store, so it routes the same way a fresh "New Chat" draft would.
      void navigate({ to: "/draft/$draftId", params: { draftId: card.threadId } });
    },
    [navigate],
  );

  const selectCard = useCallback((card: KanbanCard) => {
    setSelectedCardId((current) => (current === card.cardId ? null : card.cardId));
  }, []);

  const activeBoard = useMemo(
    () =>
      projectId
        ? (board.projects.find((project) => project.projectId === projectId) ?? null)
        : null,
    [board.projects, projectId],
  );

  if (allProjects.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Add a project to start tracking tasks here.
      </div>
    );
  }

  if (projectId) {
    if (!activeBoard) {
      return (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          This project has no tasks yet.
        </div>
      );
    }
    return (
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          <ProjectBoard board={activeBoard} layout="focused" onSelectCard={selectCard} />
        </div>
        {selectedCard ? (
          <KanbanTaskDetail
            card={selectedCard}
            onClose={() => setSelectedCardId(null)}
            onOpenThread={openThread}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {board.projects.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            No tasks yet — start a chat in a project to see it here.
          </div>
        ) : (
          <TaskListView
            boards={board.projects}
            selectedCardId={selectedCardId}
            onSelectCard={selectCard}
          />
        )}
      </div>
      {selectedCard ? (
        <KanbanTaskDetail
          card={selectedCard}
          onClose={() => setSelectedCardId(null)}
          onOpenThread={openThread}
        />
      ) : null}
    </div>
  );
}
