import {
  OrchestrationGetTurnDiffResult,
  type OrchestrationCompareCheckpointsInput,
  type OrchestrationCompareCheckpointsResult,
  type OrchestrationGetFullThreadDiffInput,
  type OrchestrationGetFullThreadDiffResult,
  type OrchestrationGetTurnDiffResult as OrchestrationGetTurnDiffResultType,
} from "@modesto/contracts";
import { Effect, Layer, Option, Schema } from "effect";

import { ProjectionSnapshotQuery } from "../../orchestration/Services/ProjectionSnapshotQuery.ts";
import { CheckpointInvariantError, CheckpointUnavailableError } from "../Errors.ts";
import {
  checkpointRefForThreadTurn,
  checkpointRefForThreadTurnInManagedFamily,
  checkpointRefForThreadTurnStart,
  checkpointRefForThreadTurnStartInManagedFamily,
  resolveThreadWorkspaceCwd,
} from "../Utils.ts";
import { CheckpointStore } from "../Services/CheckpointStore.ts";
import { CheckpointDiffBlobStore } from "../../persistence/Services/CheckpointDiffBlobs.ts";
import {
  CheckpointDiffQuery,
  type CheckpointDiffQueryShape,
} from "../Services/CheckpointDiffQuery.ts";

const isTurnDiffResult = Schema.is(OrchestrationGetTurnDiffResult);

// Turns backed only by a live provider-reported diff (no git checkpoint yet,
// or ever, in a non-git workspace) get a synthetic ref instead of a real git
// ref — see the `turn.diff.updated` handling in ProviderRuntimeIngestion.ts.
function isProviderDiffPlaceholderRef(checkpointRef: string | null | undefined): boolean {
  return checkpointRef?.startsWith("provider-diff:") === true;
}

function buildTurnDiffResult(input: {
  readonly threadId: OrchestrationGetTurnDiffResultType["threadId"];
  readonly fromTurnCount: number;
  readonly toTurnCount: number;
  readonly diff: string;
}): OrchestrationGetTurnDiffResultType {
  return {
    threadId: input.threadId,
    fromTurnCount: input.fromTurnCount,
    toTurnCount: input.toTurnCount,
    diff: input.diff,
  };
}

const make = Effect.gen(function* () {
  const projectionSnapshotQuery = yield* ProjectionSnapshotQuery;
  const checkpointStore = yield* CheckpointStore;
  const checkpointDiffBlobStore = yield* CheckpointDiffBlobStore;

  const compareCheckpoints: CheckpointDiffQueryShape["compareCheckpoints"] = (
    input: OrchestrationCompareCheckpointsInput,
  ) =>
    Effect.gen(function* () {
      const operation = "CheckpointDiffQuery.compareCheckpoints";
      const threadContext = yield* projectionSnapshotQuery.getThreadCheckpointContext(
        input.threadId,
      );
      if (Option.isNone(threadContext)) {
        return yield* new CheckpointInvariantError({
          operation,
          detail: `Thread '${input.threadId}' not found.`,
        });
      }

      const workspaceCwd = resolveThreadWorkspaceCwd({
        thread: {
          projectId: threadContext.value.projectId,
          envMode: threadContext.value.envMode,
          worktreePath: threadContext.value.worktreePath,
        },
        projects: [
          {
            id: threadContext.value.projectId,
            kind: threadContext.value.projectKind,
            workspaceRoot: threadContext.value.workspaceRoot,
          },
        ],
      });
      if (!workspaceCwd) {
        return yield* new CheckpointInvariantError({
          operation,
          detail: `Workspace path missing for thread '${input.threadId}' when comparing checkpoints.`,
        });
      }

      const fromExists = yield* checkpointStore.hasCheckpointRef({
        cwd: workspaceCwd,
        checkpointRef: input.fromCheckpointRef,
      });
      if (!fromExists) {
        const turnCount =
          threadContext.value.checkpoints.find(
            (checkpoint) => checkpoint.checkpointRef === input.fromCheckpointRef,
          )?.checkpointTurnCount ?? 0;
        return yield* new CheckpointUnavailableError({
          threadId: input.threadId,
          turnCount,
          detail: `Checkpoint ref '${input.fromCheckpointRef}' is unavailable.`,
        });
      }
      const toExists =
        input.toCheckpointRef === input.fromCheckpointRef
          ? true
          : yield* checkpointStore.hasCheckpointRef({
              cwd: workspaceCwd,
              checkpointRef: input.toCheckpointRef,
            });
      if (!toExists) {
        const turnCount =
          threadContext.value.checkpoints.find(
            (checkpoint) => checkpoint.checkpointRef === input.toCheckpointRef,
          )?.checkpointTurnCount ?? 0;
        return yield* new CheckpointUnavailableError({
          threadId: input.threadId,
          turnCount,
          detail: `Checkpoint ref '${input.toCheckpointRef}' is unavailable.`,
        });
      }

      const diff =
        input.fromCheckpointRef === input.toCheckpointRef
          ? ""
          : yield* checkpointStore.diffCheckpoints({
              cwd: workspaceCwd,
              fromCheckpointRef: input.fromCheckpointRef,
              toCheckpointRef: input.toCheckpointRef,
              fallbackFromToHead: false,
              ignoreWhitespace: input.ignoreWhitespace ?? true,
            });
      return {
        threadId: input.threadId,
        fromCheckpointRef: input.fromCheckpointRef,
        toCheckpointRef: input.toCheckpointRef,
        diff,
      } satisfies OrchestrationCompareCheckpointsResult;
    });

  const getTurnDiff: CheckpointDiffQueryShape["getTurnDiff"] = (input) =>
    Effect.gen(function* () {
      const operation = "CheckpointDiffQuery.getTurnDiff";
      const ignoreWhitespace = input.ignoreWhitespace ?? true;

      if (input.fromTurnCount === input.toTurnCount) {
        const emptyDiff: OrchestrationGetTurnDiffResultType = {
          threadId: input.threadId,
          fromTurnCount: input.fromTurnCount,
          toTurnCount: input.toTurnCount,
          diff: "",
        };
        if (!isTurnDiffResult(emptyDiff)) {
          return yield* new CheckpointInvariantError({
            operation,
            detail: "Computed turn diff result does not satisfy contract schema.",
          });
        }
        return emptyDiff;
      }

      const threadContext = yield* projectionSnapshotQuery.getThreadCheckpointContext(
        input.threadId,
      );
      if (Option.isNone(threadContext)) {
        return yield* new CheckpointInvariantError({
          operation,
          detail: `Thread '${input.threadId}' not found.`,
        });
      }

      const maxTurnCount = threadContext.value.checkpoints.reduce(
        (max, checkpoint) => Math.max(max, checkpoint.checkpointTurnCount),
        0,
      );
      if (input.toTurnCount > maxTurnCount) {
        return yield* new CheckpointUnavailableError({
          threadId: input.threadId,
          turnCount: input.toTurnCount,
          detail: `Turn diff range exceeds current turn count: requested ${input.toTurnCount}, current ${maxTurnCount}.`,
        });
      }

      const toCheckpoint = threadContext.value.checkpoints.find(
        (checkpoint) => checkpoint.checkpointTurnCount === input.toTurnCount,
      );
      if (!toCheckpoint) {
        return yield* new CheckpointUnavailableError({
          threadId: input.threadId,
          turnCount: input.toTurnCount,
          detail: `Checkpoint ref is unavailable for turn ${input.toTurnCount}.`,
        });
      }

      // Provider-diff placeholders never reach a git-checkpointed "ready"
      // status on their own (no git repo, or git hasn't caught up yet) — the
      // usual checks below would treat that as unavailable, and resolving a
      // workspace cwd below requires a real (git-backed) project, which a
      // provider-diff-only thread may not have. For the common single-turn
      // "Review this turn" lookup, serve the provider's own raw diff text if
      // we stored one, entirely without touching git or a workspace cwd.
      if (
        isProviderDiffPlaceholderRef(toCheckpoint.checkpointRef) &&
        input.toTurnCount === input.fromTurnCount + 1
      ) {
        const blob = yield* checkpointDiffBlobStore
          .getByTurnRange({
            threadId: input.threadId,
            fromTurnCount: input.fromTurnCount,
            toTurnCount: input.toTurnCount,
          })
          .pipe(Effect.catch(() => Effect.succeed(Option.none())));
        if (Option.isSome(blob)) {
          const turnDiff = buildTurnDiffResult({
            threadId: input.threadId,
            fromTurnCount: input.fromTurnCount,
            toTurnCount: input.toTurnCount,
            diff: blob.value.diff,
          });
          if (!isTurnDiffResult(turnDiff)) {
            return yield* new CheckpointInvariantError({
              operation,
              detail: "Computed turn diff result does not satisfy contract schema.",
            });
          }
          return turnDiff;
        }
      }

      const workspaceCwd = resolveThreadWorkspaceCwd({
        thread: {
          projectId: threadContext.value.projectId,
          envMode: threadContext.value.envMode,
          worktreePath: threadContext.value.worktreePath,
        },
        projects: [
          {
            id: threadContext.value.projectId,
            kind: threadContext.value.projectKind,
            workspaceRoot: threadContext.value.workspaceRoot,
          },
        ],
      });
      if (!workspaceCwd) {
        return yield* new CheckpointInvariantError({
          operation,
          detail: `Workspace path missing for thread '${input.threadId}' when computing turn diff.`,
        });
      }

      const fromCheckpoint =
        input.fromTurnCount === 0
          ? null
          : threadContext.value.checkpoints.find(
              (checkpoint) => checkpoint.checkpointTurnCount === input.fromTurnCount,
            );
      if (fromCheckpoint?.status === "missing") {
        return yield* new CheckpointUnavailableError({
          threadId: input.threadId,
          turnCount: input.fromTurnCount,
          detail: `Checkpoint diff is not available yet for turn ${input.fromTurnCount}.`,
        });
      }

      const earliestManagedBaselineRef = threadContext.value.checkpoints
        .toSorted((left, right) => left.checkpointTurnCount - right.checkpointTurnCount)
        .map((checkpoint) =>
          checkpointRefForThreadTurnInManagedFamily(checkpoint.checkpointRef, input.threadId, 0),
        )
        .find((checkpointRef) => checkpointRef !== null);
      let fromCheckpointRef =
        input.fromTurnCount === 0
          ? (earliestManagedBaselineRef ?? checkpointRefForThreadTurn(input.threadId, 0))
          : fromCheckpoint?.checkpointRef;
      if (!fromCheckpointRef) {
        return yield* new CheckpointUnavailableError({
          threadId: input.threadId,
          turnCount: input.fromTurnCount,
          detail: `Checkpoint ref is unavailable for turn ${input.fromTurnCount}.`,
        });
      }

      const toCheckpointRef = toCheckpoint.checkpointRef;
      if (toCheckpoint.status === "missing") {
        return yield* new CheckpointUnavailableError({
          threadId: input.threadId,
          turnCount: input.toTurnCount,
          detail: `Checkpoint diff is not available yet for turn ${input.toTurnCount}.`,
        });
      }
      if (input.toTurnCount === input.fromTurnCount + 1) {
        const turnStartCheckpointRef =
          checkpointRefForThreadTurnStartInManagedFamily(
            toCheckpointRef,
            input.threadId,
            toCheckpoint.turnId,
          ) ?? checkpointRefForThreadTurnStart(input.threadId, toCheckpoint.turnId);
        const turnStartExists = yield* checkpointStore.hasCheckpointRef({
          cwd: workspaceCwd,
          checkpointRef: turnStartCheckpointRef,
        });
        if (turnStartExists) {
          fromCheckpointRef = turnStartCheckpointRef;
        }
      }

      const diff = yield* checkpointStore.diffCheckpoints({
        cwd: workspaceCwd,
        fromCheckpointRef,
        toCheckpointRef,
        fallbackFromToHead: false,
        ignoreWhitespace,
      });

      const turnDiff = buildTurnDiffResult({
        threadId: input.threadId,
        fromTurnCount: input.fromTurnCount,
        toTurnCount: input.toTurnCount,
        diff,
      });
      if (!isTurnDiffResult(turnDiff)) {
        return yield* new CheckpointInvariantError({
          operation,
          detail: "Computed turn diff result does not satisfy contract schema.",
        });
      }

      return turnDiff;
    });

  const getFullThreadDiff: CheckpointDiffQueryShape["getFullThreadDiff"] = (
    input: OrchestrationGetFullThreadDiffInput,
  ) =>
    Effect.gen(function* () {
      const operation = "CheckpointDiffQuery.getFullThreadDiff";
      const ignoreWhitespace = input.ignoreWhitespace ?? true;

      if (input.toTurnCount === 0) {
        const emptyDiff = buildTurnDiffResult({
          threadId: input.threadId,
          fromTurnCount: 0,
          toTurnCount: 0,
          diff: "",
        });
        if (!isTurnDiffResult(emptyDiff)) {
          return yield* new CheckpointInvariantError({
            operation,
            detail: "Computed full thread diff result does not satisfy contract schema.",
          });
        }
        return emptyDiff satisfies OrchestrationGetFullThreadDiffResult;
      }

      const threadContext = yield* projectionSnapshotQuery.getFullThreadDiffContext(
        input.threadId,
        input.toTurnCount,
      );
      if (Option.isNone(threadContext)) {
        return yield* new CheckpointInvariantError({
          operation,
          detail: `Thread '${input.threadId}' not found.`,
        });
      }

      if (input.toTurnCount > threadContext.value.latestCheckpointTurnCount) {
        return yield* new CheckpointUnavailableError({
          threadId: input.threadId,
          turnCount: input.toTurnCount,
          detail: `Turn diff range exceeds current turn count: requested ${input.toTurnCount}, current ${threadContext.value.latestCheckpointTurnCount}.`,
        });
      }

      const workspaceCwd = resolveThreadWorkspaceCwd({
        thread: {
          projectId: threadContext.value.projectId,
          envMode: threadContext.value.envMode,
          worktreePath: threadContext.value.worktreePath,
        },
        projects: [
          {
            id: threadContext.value.projectId,
            kind: threadContext.value.projectKind,
            workspaceRoot: threadContext.value.workspaceRoot,
          },
        ],
      });
      if (!workspaceCwd) {
        return yield* new CheckpointInvariantError({
          operation,
          detail: `Workspace path missing for thread '${input.threadId}' when computing full thread diff.`,
        });
      }

      if (!threadContext.value.toCheckpointRef) {
        return yield* new CheckpointUnavailableError({
          threadId: input.threadId,
          turnCount: input.toTurnCount,
          detail: `Checkpoint ref is unavailable for turn ${input.toTurnCount}.`,
        });
      }

      const diff = yield* checkpointStore.diffCheckpoints({
        cwd: workspaceCwd,
        fromCheckpointRef:
          (threadContext.value.baselineCheckpointRef
            ? checkpointRefForThreadTurnInManagedFamily(
                threadContext.value.baselineCheckpointRef,
                input.threadId,
                0,
              )
            : null) ?? checkpointRefForThreadTurn(input.threadId, 0),
        toCheckpointRef: threadContext.value.toCheckpointRef,
        fallbackFromToHead: false,
        ignoreWhitespace,
      });

      const fullThreadDiff = buildTurnDiffResult({
        threadId: input.threadId,
        fromTurnCount: 0,
        toTurnCount: input.toTurnCount,
        diff,
      });
      if (!isTurnDiffResult(fullThreadDiff)) {
        return yield* new CheckpointInvariantError({
          operation,
          detail: "Computed full thread diff result does not satisfy contract schema.",
        });
      }

      return fullThreadDiff satisfies OrchestrationGetFullThreadDiffResult;
    });

  return {
    compareCheckpoints,
    getTurnDiff,
    getFullThreadDiff,
  } satisfies CheckpointDiffQueryShape;
});

export const CheckpointDiffQueryLive = Layer.effect(CheckpointDiffQuery, make);
