/**
 * CheckpointDiffBlobStore - Repository interface for raw provider-reported turn diffs.
 *
 * Persists the raw unified diff text a provider reports live for a turn
 * (`turn.diff.updated`), so it can be served back for "Review" without a
 * git checkpoint to diff against. Only meaningful for turns backed by a
 * `provider-diff:` checkpoint placeholder rather than a real git checkpoint.
 *
 * @module CheckpointDiffBlobStore
 */
import { IsoDateTime, NonNegativeInt, ThreadId } from "@modesto/contracts";
import { Option, Schema, ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

export const CheckpointDiffBlob = Schema.Struct({
  threadId: ThreadId,
  fromTurnCount: NonNegativeInt,
  toTurnCount: NonNegativeInt,
  diff: Schema.String,
  createdAt: IsoDateTime,
});
export type CheckpointDiffBlob = typeof CheckpointDiffBlob.Type;

export const GetCheckpointDiffBlobInput = Schema.Struct({
  threadId: ThreadId,
  fromTurnCount: NonNegativeInt,
  toTurnCount: NonNegativeInt,
});
export type GetCheckpointDiffBlobInput = typeof GetCheckpointDiffBlobInput.Type;

export const DeleteCheckpointDiffBlobsAfterTurnCountInput = Schema.Struct({
  threadId: ThreadId,
  turnCount: NonNegativeInt,
});
export type DeleteCheckpointDiffBlobsAfterTurnCountInput =
  typeof DeleteCheckpointDiffBlobsAfterTurnCountInput.Type;

/**
 * CheckpointDiffBlobStoreShape - Service API for raw turn-diff blob persistence.
 */
export interface CheckpointDiffBlobStoreShape {
  /**
   * Insert or replace a raw diff blob row.
   *
   * Upserts by `(threadId, fromTurnCount, toTurnCount)`.
   */
  readonly upsert: (row: CheckpointDiffBlob) => Effect.Effect<void, ProjectionRepositoryError>;

  /**
   * Read a stored diff blob for a turn range, if one was captured.
   */
  readonly getByTurnRange: (
    input: GetCheckpointDiffBlobInput,
  ) => Effect.Effect<Option.Option<CheckpointDiffBlob>, ProjectionRepositoryError>;

  /**
   * Delete blob rows for turn counts a revert dropped from the projection.
   *
   * Not required for correctness (unreachable rows are simply never looked
   * up again, and a reused turn count safely overwrites its old row on the
   * next upsert) — this exists to bound storage growth across revert/redo
   * cycles.
   */
  readonly deleteAfterTurnCount: (
    input: DeleteCheckpointDiffBlobsAfterTurnCountInput,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
}

/**
 * CheckpointDiffBlobStore - Service tag for raw turn-diff blob persistence.
 */
export class CheckpointDiffBlobStore extends ServiceMap.Service<
  CheckpointDiffBlobStore,
  CheckpointDiffBlobStoreShape
>()("modesto/persistence/Services/CheckpointDiffBlobs/CheckpointDiffBlobStore") {}
