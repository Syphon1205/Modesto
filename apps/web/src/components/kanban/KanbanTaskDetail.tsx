// FILE: KanbanTaskDetail.tsx
// Purpose: The task detail sidebar - what a task is and what it changed,
//          without leaving the board.
// Layer: Kanban UI
//
// Clicking a card used to navigate straight into the chat, which threw away
// the board you were reading. Scanning tasks and opening one are different
// intentions: this answers "what happened here" in place, and opening the
// thread stays available as an explicit action.

import type { ScopedThreadRef } from "@modesto/contracts";
import { FileDiffIcon, XIcon } from "lucide-react";
import { useMemo } from "react";

import { cn } from "../../lib/utils";
import { useThread } from "../../state/entities";
import { Button } from "../ui/button";
import type { KanbanCard } from "./kanban.logic";
import { KANBAN_COLUMN_LABELS } from "./kanban.logic";
import { summarizeTaskChanges } from "./taskChangeSummary";

function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm text-foreground">{value}</div>
    </div>
  );
}

export function KanbanTaskDetail({
  card,
  onClose,
  onOpenThread,
}: {
  readonly card: KanbanCard;
  readonly onClose: () => void;
  readonly onOpenThread: (card: KanbanCard) => void;
}) {
  const threadRef: ScopedThreadRef | null = card.thread
    ? { environmentId: card.thread.environmentId, threadId: card.threadId }
    : null;
  const thread = useThread(threadRef);
  const changes = useMemo(
    () => summarizeTaskChanges(thread?.checkpoints ?? []),
    [thread?.checkpoints],
  );

  return (
    <aside
      aria-label={`Task details: ${card.title}`}
      className="flex h-full w-80 shrink-0 flex-col border-s border-border/60 bg-background"
    >
      <header className="flex shrink-0 items-start gap-2 border-b border-border/60 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-medium text-foreground" title={card.title}>
            {card.title}
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {KANBAN_COLUMN_LABELS[card.column]}
          </p>
        </div>
        <Button size="icon-xs" variant="ghost" aria-label="Close task details" onClick={onClose}>
          <XIcon className="size-3.5" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Stat label="Branch" value={card.branch ?? "—"} />
          <Stat label="Provider" value={card.provider ?? (card.isTerminal ? "Terminal" : "—")} />
        </div>

        <section className="mt-5">
          <div className="flex items-center gap-2">
            <FileDiffIcon className="size-3.5 text-muted-foreground" aria-hidden />
            <h3 className="text-[13px] font-medium text-foreground">Changes</h3>
            {changes.files.length > 0 ? (
              <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                <span className="text-success">+{changes.additions}</span>{" "}
                <span className="text-error">−{changes.deletions}</span>
              </span>
            ) : null}
          </div>

          {changes.files.length === 0 ? (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {/* A draft has not run; a finished task may simply have read code.
                  Saying so beats an empty list that reads like a failure. */}
              {card.thread === null
                ? "This task has not run yet."
                : "No file changes were recorded for this task."}
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {changes.files.map((file) => (
                <li
                  key={file.path}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs"
                  title={file.path}
                >
                  <span className="min-w-0 flex-1 truncate text-foreground/90">{file.path}</span>
                  <span className="shrink-0 tabular-nums text-[11px]">
                    <span className="text-success">+{file.additions}</span>{" "}
                    <span className="text-error">−{file.deletions}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {changes.turnCount > 0 ? (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Across {changes.turnCount} turn{changes.turnCount === 1 ? "" : "s"}.
            </p>
          ) : null}
        </section>
      </div>

      <footer className="shrink-0 border-t border-border/60 p-3">
        <Button
          size="sm"
          variant="secondary"
          className={cn("w-full")}
          onClick={() => onOpenThread(card)}
        >
          Open thread
        </Button>
      </footer>
    </aside>
  );
}
