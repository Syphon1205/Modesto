// FILE: TaskListView.tsx
// Purpose: The Tasks overview - every project's tasks as a dense, scannable
//          list rather than a board.
// Layer: Tasks UI
//
// A three-column board is the wrong shape for an overview of many projects.
// Real projects put nearly everything in one column, so the board renders as
// two empty lanes beside one full one no matter how it is styled - and styling
// around that (narrowing the empty lanes) only produced a stretched Done
// column, which is worse.
//
// Columns earn their place for a single project, where you are moving work
// between them; that is what the focused board is for. Here the question is
// "what is happening across my projects", which a list answers better: one row
// per task, status carried by a chip, sorted by recency.

import { memo } from "react";

import { formatRelativeTimeLabel } from "../../timestampFormat";
import { cn } from "../../lib/utils";
import { KanbanStatusIcon } from "./KanbanStatusIcon";
import {
  KANBAN_COLUMN_LABELS,
  type KanbanCard,
  type KanbanColumnKey,
  type KanbanProjectBoard,
} from "./kanban.logic";

const COLUMN_TONE: Readonly<Record<KanbanColumnKey, string>> = {
  draft: "text-muted-foreground",
  inProgress: "text-warning",
  done: "text-success",
};

const TaskRow = memo(function TaskRow({
  card,
  isSelected,
  onSelect,
}: {
  readonly card: KanbanCard;
  readonly isSelected: boolean;
  readonly onSelect: (card: KanbanCard) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={() => onSelect(card)}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
        isSelected ? "bg-sidebar-control-surface" : "hover:bg-sidebar-row-hover",
      )}
    >
      <span
        className={cn("flex size-4 shrink-0 items-center justify-center", COLUMN_TONE[card.column])}
      >
        <KanbanStatusIcon column={card.column} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={card.title}>
        {card.title}
      </span>
      {card.branch ? (
        <span className="hidden shrink-0 truncate text-[11px] text-muted-foreground/80 sm:block sm:max-w-40">
          {card.branch}
        </span>
      ) : null}
      {card.provider ? (
        <span className="hidden shrink-0 text-[11px] text-muted-foreground/70 md:block">
          {card.provider}
        </span>
      ) : null}
      <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground/70">
        {card.timestamp ? formatRelativeTimeLabel(card.timestamp) : ""}
      </span>
      <span className="w-20 shrink-0 text-right text-[11px] text-muted-foreground/70">
        {KANBAN_COLUMN_LABELS[card.column]}
      </span>
    </button>
  );
});

export function TaskListView({
  boards,
  selectedCardId,
  onSelectCard,
}: {
  readonly boards: ReadonlyArray<KanbanProjectBoard>;
  readonly selectedCardId: string | null;
  readonly onSelectCard: (card: KanbanCard) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl p-4">
      {boards.map((board) => {
        // In Progress first, then Draft, then Done: what needs attention leads,
        // and finished work - which is most of the list - trails.
        const cards = [...board.inProgress, ...board.draft, ...board.done];
        return (
          <section key={board.projectId} className="mb-6 last:mb-0">
            <header className="flex items-baseline gap-2 px-3 pb-1">
              <h2 className="truncate text-[13px] font-medium text-foreground/90">
                {board.projectName}
              </h2>
              <span className="text-xs tabular-nums text-muted-foreground/70">
                {board.totalCount}
              </span>
            </header>
            {cards.length === 0 ? (
              <p className="px-3 py-1 text-xs text-muted-foreground/60">No tasks</p>
            ) : (
              <ul className="space-y-0.5">
                {cards.map((card) => (
                  <li key={card.cardId}>
                    <TaskRow
                      card={card}
                      isSelected={card.cardId === selectedCardId}
                      onSelect={onSelectCard}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
