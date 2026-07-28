/**
 * Durable agent-handoff checkpoints — orphan commits under
 * refs/modesto/agent-checkpoints/<source>/<dest>/{base,tree}.
 *
 * Capture pins HEAD as `base` and the working tree as `tree` so the seam can
 * be inspected or restored later without touching user-visible branches.
 *
 * Declarations are idempotent: if the working-tree oid already matches the
 * existing tree ref, capture returns the prior refs and no-ops.
 */
import {
  CheckpointRef,
  type OrchestrationCaptureHandoffCheckpointInput,
  type OrchestrationCaptureHandoffCheckpointResult,
  type OrchestrationGetHandoffCheckpointDiffInput,
  type OrchestrationGetHandoffCheckpointDiffResult,
  type OrchestrationRestoreHandoffCheckpointInput,
  type OrchestrationRestoreHandoffCheckpointResult,
  type ThreadHandoff,
  type ThreadId,
} from "@modesto/contracts";
import { Effect } from "effect";

import type { CheckpointStoreShape } from "./Services/CheckpointStore.ts";
import {
  checkpointRefForAgentHandoffBase,
  checkpointRefForAgentHandoffTree,
} from "./Utils.ts";

const HEAD_CHECKPOINT_REF = CheckpointRef.makeUnsafe("HEAD");

function missingCaptureResult(): OrchestrationCaptureHandoffCheckpointResult {
  return {
    checkpointRef: null,
    baseCheckpointRef: null,
    baseHeadSha: null,
    checkpointStatus: "missing" as const,
    unchanged: false,
  };
}

export function captureAgentHandoffCheckpoint(
  checkpointStore: CheckpointStoreShape,
  input: OrchestrationCaptureHandoffCheckpointInput,
): Effect.Effect<OrchestrationCaptureHandoffCheckpointResult> {
  return Effect.gen(function* () {
    const isGit = yield* checkpointStore.isGitRepository(input.cwd);
    if (!isGit) {
      return {
        checkpointRef: null,
        baseCheckpointRef: null,
        baseHeadSha: null,
        checkpointStatus: "not_applicable" as const,
        unchanged: false,
      };
    }

    const treeRef = checkpointRefForAgentHandoffTree(input.sourceThreadId, input.destThreadId);
    const baseRef = checkpointRefForAgentHandoffBase(input.sourceThreadId, input.destThreadId);
    const baseHeadSha = yield* checkpointStore.resolveHeadCommitOid(input.cwd);

    const existingTreeOid = yield* checkpointStore.resolveCheckpointTreeOid({
      cwd: input.cwd,
      checkpointRef: treeRef,
    });
    if (existingTreeOid !== null) {
      const workingTreeOid = yield* checkpointStore.resolveWorkingTreeOid(input.cwd);
      if (workingTreeOid !== null && workingTreeOid === existingTreeOid) {
        const hasBase = yield* checkpointStore.hasCheckpointRef({
          cwd: input.cwd,
          checkpointRef: baseRef,
        });
        return {
          checkpointRef: treeRef,
          baseCheckpointRef: hasBase ? baseRef : null,
          baseHeadSha,
          checkpointStatus: "captured" as const,
          unchanged: true,
        };
      }
    }

    const pinned = yield* checkpointStore.copyCheckpointRef({
      cwd: input.cwd,
      fromCheckpointRef: HEAD_CHECKPOINT_REF,
      toCheckpointRef: baseRef,
    });

    yield* checkpointStore.captureCheckpoint({
      cwd: input.cwd,
      checkpointRef: treeRef,
    });

    return {
      checkpointRef: treeRef,
      baseCheckpointRef: pinned ? baseRef : null,
      baseHeadSha,
      checkpointStatus: "captured" as const,
      unchanged: false,
    };
  }).pipe(Effect.catch(() => Effect.succeed(missingCaptureResult())));
}

export function diffAgentHandoffCheckpoint(
  checkpointStore: CheckpointStoreShape,
  input: OrchestrationGetHandoffCheckpointDiffInput & {
    readonly handoff: ThreadHandoff | null;
  },
): Effect.Effect<OrchestrationGetHandoffCheckpointDiffResult> {
  return Effect.gen(function* () {
    const handoff = input.handoff;
    const checkpointStatus = handoff?.checkpointStatus ?? "not_applicable";
    const checkpointRef = handoff?.checkpointRef ?? null;
    const baseCheckpointRef = handoff?.baseCheckpointRef ?? null;

    if (!handoff || !checkpointRef || checkpointStatus === "not_applicable") {
      return {
        threadId: input.threadId,
        diff: "",
        checkpointRef,
        baseCheckpointRef,
        checkpointStatus,
      };
    }

    const exists = yield* checkpointStore.hasCheckpointRef({
      cwd: input.cwd,
      checkpointRef,
    });
    if (!exists) {
      return {
        threadId: input.threadId,
        diff: "",
        checkpointRef,
        baseCheckpointRef,
        checkpointStatus: "missing" as const,
      };
    }

    const fromCheckpointRef = baseCheckpointRef ?? HEAD_CHECKPOINT_REF;
    const diff = yield* checkpointStore.diffCheckpoints({
      cwd: input.cwd,
      fromCheckpointRef,
      toCheckpointRef: checkpointRef,
      fallbackFromToHead: baseCheckpointRef === null,
      ignoreWhitespace: input.ignoreWhitespace ?? true,
    });

    return {
      threadId: input.threadId,
      diff,
      checkpointRef,
      baseCheckpointRef,
      checkpointStatus,
    };
  }).pipe(
    Effect.catch(() =>
      Effect.succeed({
        threadId: input.threadId,
        diff: "",
        checkpointRef: input.handoff?.checkpointRef ?? null,
        baseCheckpointRef: input.handoff?.baseCheckpointRef ?? null,
        checkpointStatus: "missing" as const,
      }),
    ),
  );
}

export function restoreAgentHandoffCheckpoint(
  checkpointStore: CheckpointStoreShape,
  input: OrchestrationRestoreHandoffCheckpointInput & {
    readonly handoff: ThreadHandoff | null;
  },
): Effect.Effect<OrchestrationRestoreHandoffCheckpointResult> {
  return Effect.gen(function* () {
    const checkpointRef = input.handoff?.checkpointRef ?? null;
    if (!checkpointRef) {
      return { restored: false, checkpointRef: null };
    }

    const restored = yield* checkpointStore.restoreCheckpoint({
      cwd: input.cwd,
      checkpointRef,
      fallbackToHead: false,
    });

    return { restored, checkpointRef };
  }).pipe(Effect.catch(() => Effect.succeed({ restored: false, checkpointRef: null })));
}

export function resolveAgentHandoffCheckpointRefs(input: {
  readonly sourceThreadId: ThreadId;
  readonly destThreadId: ThreadId;
}): {
  readonly checkpointRef: CheckpointRef;
  readonly baseCheckpointRef: CheckpointRef;
} {
  return {
    checkpointRef: checkpointRefForAgentHandoffTree(input.sourceThreadId, input.destThreadId),
    baseCheckpointRef: checkpointRefForAgentHandoffBase(input.sourceThreadId, input.destThreadId),
  };
}
