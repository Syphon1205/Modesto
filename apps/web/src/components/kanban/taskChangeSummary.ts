// FILE: taskChangeSummary.ts
// Purpose: What a task actually changed, aggregated across its turns.
// Layer: Kanban model (pure - no React)
//
// A thread records one checkpoint per turn, each listing the files that turn
// touched. A task that edited the same file across five turns therefore appears
// five times with five separate counts, which is not what "what did this task
// change" means. This folds them into one row per file.

import type {
  OrchestrationCheckpointFile,
  OrchestrationCheckpointSummary,
} from "@modesto/contracts";

export interface TaskChangedFile {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
  /** How many turns touched this file; 1 for most. */
  readonly turnCount: number;
}

export interface TaskChangeSummary {
  readonly files: ReadonlyArray<TaskChangedFile>;
  readonly additions: number;
  readonly deletions: number;
  /** Turns that produced a usable checkpoint. */
  readonly turnCount: number;
}

export const EMPTY_TASK_CHANGE_SUMMARY: TaskChangeSummary = {
  files: [],
  additions: 0,
  deletions: 0,
  turnCount: 0,
};

/**
 * Folds every turn's checkpoint into one summary.
 *
 * Only `ready` checkpoints count. A `missing` or `error` checkpoint has no
 * trustworthy file list, and counting it would report changes that may not
 * exist - worse than reporting none.
 *
 * Files are ordered by total churn so the biggest change is first, which is
 * what someone scanning "what happened here" is looking for. Ties break on
 * path so the order is stable between renders.
 */
export function summarizeTaskChanges(
  checkpoints: ReadonlyArray<OrchestrationCheckpointSummary>,
): TaskChangeSummary {
  const byPath = new Map<string, { additions: number; deletions: number; turnCount: number }>();
  let turnCount = 0;

  for (const checkpoint of checkpoints) {
    if (checkpoint.status !== "ready" || checkpoint.files.length === 0) continue;
    turnCount += 1;
    for (const file of checkpoint.files as ReadonlyArray<OrchestrationCheckpointFile>) {
      const existing = byPath.get(file.path);
      if (existing) {
        existing.additions += file.additions;
        existing.deletions += file.deletions;
        existing.turnCount += 1;
        continue;
      }
      byPath.set(file.path, {
        additions: file.additions,
        deletions: file.deletions,
        turnCount: 1,
      });
    }
  }

  const files: TaskChangedFile[] = [];
  for (const [path, totals] of byPath) {
    files.push({
      path,
      additions: totals.additions,
      deletions: totals.deletions,
      turnCount: totals.turnCount,
    });
  }
  const ordered = files.toSorted((left, right) => {
    const churn = right.additions + right.deletions - (left.additions + left.deletions);
    return churn === 0 ? left.path.localeCompare(right.path) : churn;
  });

  return {
    files: ordered,
    additions: ordered.reduce((total, file) => total + file.additions, 0),
    deletions: ordered.reduce((total, file) => total + file.deletions, 0),
    turnCount,
  };
}
