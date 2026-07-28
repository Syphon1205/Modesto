// FILE: ComposerChromeBubbles.tsx
// Purpose: Cursor-style compact status pills stacked above the composer —
// Changes, Commit, Working, and Tasks. Mode controls (Agent/Plan) and
// Multi-agent live in the composer footer so they behave like Cursor/Codex.
// Layer: Chat composer UI
// Exports: ComposerChromeBubbles

import { pluralize } from "@modesto/shared/text";
import { memo, type ReactNode } from "react";

import type { ActiveTaskListState } from "../../session-logic";
import {
  ActivityIcon,
  ChangesIcon,
  ChevronDownIcon,
  ListChecksIcon,
  LoaderIcon,
} from "~/lib/icons";
import { cn } from "~/lib/utils";
import {
  COMPOSER_CHROME_BUBBLE_CLASS_NAME,
  COMPOSER_CHROME_BUBBLE_ICON_CLASS_NAME,
  COMPOSER_CHROME_BUBBLES_ROW_CLASS_NAME,
} from "./composerChromeBubbleStyles";
import { DiffStatLabel } from "./DiffStatLabel";

export interface ComposerChromeBubblesProps {
  /** Working-tree (or selected scope) diff totals for the Changes bubble. */
  readonly changes:
    | {
        readonly additions: number;
        readonly deletions: number;
        readonly hasChanges: boolean;
      }
    | null;
  readonly onOpenChanges?: (() => void) | undefined;
  /** Pre-built Commit & Push control (GitActionsControl bubble variant). */
  readonly commitControl?: ReactNode;
  readonly isWorking: boolean;
  readonly workingCount: number;
  readonly activeTaskList: ActiveTaskListState | null;
  readonly onOpenTasks?: (() => void) | undefined;
}

function ChromeBubble({
  children,
  disabled = false,
  onClick,
  title,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: (() => void) | undefined;
  title?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      className={COMPOSER_CHROME_BUBBLE_CLASS_NAME}
      disabled={disabled || !onClick}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

export const ComposerChromeBubbles = memo(function ComposerChromeBubbles({
  changes,
  onOpenChanges,
  commitControl,
  isWorking,
  workingCount,
  activeTaskList,
  onOpenTasks,
}: ComposerChromeBubblesProps) {
  const showChanges = Boolean(changes?.hasChanges && onOpenChanges);
  const showWorking = isWorking;
  const showTodos = Boolean(activeTaskList && activeTaskList.tasks.length > 0 && onOpenTasks);

  if (!showChanges && !commitControl && !showWorking && !showTodos) {
    return null;
  }

  const completedCount = activeTaskList
    ? activeTaskList.tasks.filter((task) => task.status === "completed").length
    : 0;
  const totalCount = activeTaskList?.tasks.length ?? 0;
  const todosInProgress = activeTaskList?.tasks.some((task) => task.status === "inProgress") ?? false;

  return (
    <div className={COMPOSER_CHROME_BUBBLES_ROW_CLASS_NAME} data-testid="composer-chrome-bubbles">
      {showChanges && changes ? (
        <ChromeBubble
          onClick={onOpenChanges}
          title="Review working-tree changes"
          aria-label="Review changes"
        >
          <ChangesIcon className={COMPOSER_CHROME_BUBBLE_ICON_CLASS_NAME} />
          <span>Changes</span>
          <DiffStatLabel additions={changes.additions} deletions={changes.deletions} />
        </ChromeBubble>
      ) : null}

      {commitControl}

      {showWorking ? (
        <ChromeBubble disabled title="Agent is working" aria-label={`${workingCount} working`}>
          <ActivityIcon
            className={cn(COMPOSER_CHROME_BUBBLE_ICON_CLASS_NAME, "motion-safe:animate-pulse")}
          />
          <span>{workingCount} Working</span>
        </ChromeBubble>
      ) : null}

      {showTodos && activeTaskList ? (
        <ChromeBubble
          onClick={onOpenTasks}
          title="Open task list"
          aria-label={`${completedCount} of ${totalCount} tasks`}
        >
          {todosInProgress ? (
            <LoaderIcon className={cn(COMPOSER_CHROME_BUBBLE_ICON_CLASS_NAME, "animate-spin")} />
          ) : (
            <ListChecksIcon className={COMPOSER_CHROME_BUBBLE_ICON_CLASS_NAME} />
          )}
          <span>
            {completedCount}/{totalCount} {pluralize(totalCount, "task")}
          </span>
          <ChevronDownIcon className="size-3 shrink-0 opacity-55" />
        </ChromeBubble>
      ) : null}
    </div>
  );
});
