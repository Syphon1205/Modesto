// FILE: KanbanCardView.tsx
// Purpose: Presentational kanban card - title, draft preview, provider/branch meta
//          row with status pill and relative timestamp.
// Layer: UI component (pure; drag wiring lives in KanbanColumn)
// Exports: KanbanCardView
//
// A from-scratch, simplified sibling of the original (pre-migration) Modesto's
// KanbanCardView: same information (title, draft preview, provider, branch, status,
// timestamp), built on this tree's real status-pill helper (Sidebar.logic.ts) instead
// of porting the original's central icon-theme system and Zustand thread selector.

import { GitBranchIcon, PaperclipIcon, TerminalIcon } from "lucide-react";
import { memo } from "react";

import { formatRelativeTimeLabel } from "../../timestampFormat";
import { cn } from "../../lib/utils";
import { resolveThreadStatusPill } from "../Sidebar.logic";
import { KanbanStatusIcon } from "./KanbanStatusIcon";
import { KANBAN_COLUMN_LABELS, kanbanThreadCardId, type KanbanCard } from "./kanban.logic";

export interface KanbanCardViewProps {
  card: KanbanCard;
  onOpen?: (card: KanbanCard) => void;
  onContextMenu?: (card: KanbanCard, event: React.MouseEvent) => void;
  isOverlay?: boolean;
  isDragSource?: boolean;
}

const REDUNDANT_COLUMN_PILL_LABELS = new Set(["Working", "Connecting", "Completed"]);

function KanbanCardColumnLabel({ card }: { card: KanbanCard }) {
  if (card.isTerminal) {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground/80">
        <TerminalIcon className="size-3 shrink-0" aria-hidden />
        Terminal
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground/80">
      <KanbanStatusIcon column={card.column} className="size-3" />
      {KANBAN_COLUMN_LABELS[card.column]}
    </span>
  );
}

function KanbanCardStatusPill({ card }: { card: KanbanCard }) {
  const pill = card.thread ? resolveThreadStatusPill({ thread: card.thread }) : null;
  if (!pill || REDUNDANT_COLUMN_PILL_LABELS.has(pill.label)) {
    return null;
  }
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5 text-[11px]", pill.colorClass)}>
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          pill.dotClass,
          pill.pulse && "animate-pulse",
        )}
      />
      <span className="truncate">{pill.label}</span>
    </span>
  );
}

function KanbanCardViewComponent({
  card,
  onOpen,
  onContextMenu,
  isOverlay = false,
  isDragSource = false,
}: KanbanCardViewProps) {
  const showDraftPreview =
    card.column === "draft" &&
    card.draftPrompt.length > 0 &&
    card.cardId === kanbanThreadCardId(card.threadId);

  return (
    <button
      type="button"
      tabIndex={isOverlay ? -1 : 0}
      onClick={onOpen ? () => onOpen(card) : undefined}
      onContextMenu={onContextMenu ? (event) => onContextMenu(card, event) : undefined}
      className={cn(
        "flex w-full cursor-pointer flex-col gap-1.5 rounded-lg border border-border bg-card/70 px-3 py-2.5 text-left shadow-sm transition-colors",
        "hover:bg-card focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        isOverlay && "bg-card shadow-lg",
        isDragSource && "opacity-40",
      )}
    >
      <span className="flex min-w-0 items-start gap-1.5">
        <span className="line-clamp-2 min-w-0 flex-1 text-[13px] font-medium leading-snug text-foreground/90">
          {card.title}
        </span>
      </span>
      {showDraftPreview ? (
        <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">
          {card.draftPrompt}
        </span>
      ) : null}
      <span className="flex min-w-0 items-center gap-2 pt-0.5">
        {!card.isTerminal && card.provider ? (
          <span className="max-w-24 shrink-0 truncate text-[11px] text-muted-foreground/70">
            {card.provider}
          </span>
        ) : null}
        {card.branch ? (
          <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground/70">
            <GitBranchIcon className="size-3 shrink-0" aria-hidden />
            <span className="max-w-32 truncate">{card.branch}</span>
          </span>
        ) : null}
        {card.draftHasAttachments ? (
          <PaperclipIcon className="size-3 shrink-0 text-muted-foreground/70" aria-hidden />
        ) : null}
        <span className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
          {card.isOptimisticDispatch ? (
            <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-sky-600 dark:text-sky-300/90">
              Starting…
            </span>
          ) : (
            <>
              <KanbanCardStatusPill card={card} />
              {card.timestamp ? (
                <span className="shrink-0 text-[11px] text-muted-foreground/70">
                  {formatRelativeTimeLabel(card.timestamp)}
                </span>
              ) : null}
            </>
          )}
          <KanbanCardColumnLabel card={card} />
        </span>
      </span>
    </button>
  );
}

export const KanbanCardView = memo(KanbanCardViewComponent);
