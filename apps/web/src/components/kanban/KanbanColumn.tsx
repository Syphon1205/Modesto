// FILE: KanbanColumn.tsx
// Purpose: One kanban column - droppable body, sortable draft cards, done render cap.
// Layer: UI component (project-board building block)
// Exports: KanbanColumn, kanbanColumnDropId, parseKanbanColumnDropId
//
// Ported from the original (pre-migration) Modesto's KanbanColumn.tsx, adapted to this
// tree's simplified KanbanCardView (no nowMs prop) and plain lucide-react PlusIcon.

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ProjectId } from "@modesto/contracts";
import { PlusIcon } from "lucide-react";
import { memo, useMemo, useState } from "react";

import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { KanbanCardView } from "./KanbanCardView";
import { KanbanStatusIcon } from "./KanbanStatusIcon";
import {
  KANBAN_COLUMN_LABELS,
  resolveDraftDropAction,
  type KanbanCard,
  type KanbanColumnKey,
} from "./kanban.logic";

const COLUMN_DROP_ID_PREFIX = "kanban-column";
const DONE_RENDER_CAP = 30;

export function kanbanColumnDropId(projectId: ProjectId, column: KanbanColumnKey): string {
  return `${COLUMN_DROP_ID_PREFIX}|${column}|${projectId}`;
}

export function parseKanbanColumnDropId(
  dropId: string,
): { projectId: string; column: KanbanColumnKey } | null {
  const [prefix, column, ...projectIdParts] = dropId.split("|");
  if (prefix !== COLUMN_DROP_ID_PREFIX || projectIdParts.length === 0) {
    return null;
  }
  if (column !== "draft" && column !== "inProgress" && column !== "done") {
    return null;
  }
  return { projectId: projectIdParts.join("|"), column };
}

function SortableKanbanCard({
  card,
  onOpen,
  onContextMenu,
}: {
  card: KanbanCard;
  onOpen: (card: KanbanCard) => void;
  onContextMenu?: ((card: KanbanCard, event: React.MouseEvent) => void) | undefined;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.cardId,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("list-none", isDragging && "z-20")}
      {...attributes}
      {...listeners}
    >
      <KanbanCardView
        card={card}
        onOpen={onOpen}
        {...(onContextMenu ? { onContextMenu } : {})}
        isDragSource={isDragging}
      />
    </li>
  );
}

function KanbanColumnComponent({
  projectId,
  columnKey,
  cards,
  onOpenCard,
  onCardContextMenu,
  sortable = false,
  droppable = false,
  activeCard = null,
  onNewCard,
  renderCap,
  scrollable = true,
}: {
  projectId: ProjectId;
  columnKey: KanbanColumnKey;
  cards: readonly KanbanCard[];
  onOpenCard: (card: KanbanCard) => void;
  onCardContextMenu?: ((card: KanbanCard, event: React.MouseEvent) => void) | undefined;
  sortable?: boolean;
  droppable?: boolean;
  activeCard?: KanbanCard | null;
  onNewCard?: (() => void) | undefined;
  /**
   * Maximum cards to render before a "show more" row. The overview passes a
   * small number so a board ends on a whole card: capping a board by pixel
   * height instead sliced the last card in half, which reads as a rendering
   * bug rather than as "there is more here".
   */
  renderCap?: number | undefined;
  /**
   * Whether the column scrolls internally. False in the overview, where the
   * page scrolls instead: an internally scrolling column inside a
   * height-constrained board is what was slicing the last card in half.
   */
  scrollable?: boolean;
}) {
  const dropId = kanbanColumnDropId(projectId, columnKey);
  const { isOver, setNodeRef } = useDroppable({ id: dropId, disabled: !droppable });
  const [showAll, setShowAll] = useState(false);

  const effectiveCap = renderCap ?? (columnKey === "done" ? DONE_RENDER_CAP : undefined);
  const cappedCards =
    effectiveCap !== undefined && !showAll && cards.length > effectiveCap
      ? cards.slice(0, effectiveCap)
      : cards;
  const hiddenCount = cards.length - cappedCards.length;

  const sortableItems = useMemo(() => cards.map((card) => card.cardId), [cards]);

  const dispatchTarget =
    columnKey === "inProgress" &&
    activeCard !== null &&
    resolveDraftDropAction(activeCard) === "dispatch";

  const cardElements = cappedCards.map((card) =>
    sortable ? (
      <SortableKanbanCard
        key={card.cardId}
        card={card}
        onOpen={onOpenCard}
        onContextMenu={onCardContextMenu}
      />
    ) : (
      <li key={card.cardId} className="list-none">
        <KanbanCardView
          card={card}
          onOpen={onOpenCard}
          {...(onCardContextMenu ? { onContextMenu: onCardContextMenu } : {})}
        />
      </li>
    ),
  );

  return (
    <section
      className={cn(
        "flex flex-col",
        scrollable && "min-h-0",
        // An empty column keeps a lane so it stays a visible drop target, but
        // gives its width to the columns that actually have cards.
        cards.length === 0 ? "w-32 shrink-0" : "min-w-64 flex-1",
      )}
    >
      <header className="flex shrink-0 items-center gap-2 px-1.5 pb-2">
        <h3 className="truncate whitespace-nowrap text-[13px] font-medium text-foreground/90">
          {KANBAN_COLUMN_LABELS[columnKey]}
        </h3>
        <span className="text-xs text-muted-foreground/70">{cards.length}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {dispatchTarget ? (
            <span className="text-[11px] text-sky-600 dark:text-sky-300/90">Drop to send</span>
          ) : null}
          {onNewCard ? (
            <Button
              size="icon-xs"
              variant="ghost"
              className="shrink-0 text-muted-foreground/70 hover:text-foreground"
              aria-label="New task"
              title="New task"
              onClick={onNewCard}
            >
              <PlusIcon className="size-3.5" />
            </Button>
          ) : null}
          <KanbanStatusIcon column={columnKey} />
        </span>
      </header>
      <ul
        ref={setNodeRef}
        className={cn(
          // `min-h-12`, not `min-h-24`: an empty column should be a thin lane,
          // not a tall well.
          "flex min-h-12 flex-col gap-2 rounded-xl p-1 transition-colors",
          scrollable ? "flex-1 overflow-y-auto" : "shrink-0",
          dispatchTarget && "bg-sky-500/5 ring-1 ring-sky-400/30",
          dispatchTarget && isOver && "bg-sky-500/10 ring-sky-400/60",
        )}
      >
        {sortable ? (
          <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
            {cardElements}
          </SortableContext>
        ) : (
          cardElements
        )}
        {cards.length === 0 ? (
          // Deliberately quiet and short. A tall dashed box per empty column
          // meant a board with two empty columns was mostly placeholder, which
          // is most of what made the overview look chaotic. It still renders
          // something so the column stays a visible drop target.
          <li className="list-none px-1.5 py-1 text-xs text-muted-foreground/40">Empty</li>
        ) : null}
        {hiddenCount > 0 ? (
          <li className="list-none">
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full rounded-lg px-3 py-1.5 text-center text-xs text-muted-foreground/80 transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              Show {hiddenCount} more
            </button>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

export const KanbanColumn = memo(KanbanColumnComponent);
