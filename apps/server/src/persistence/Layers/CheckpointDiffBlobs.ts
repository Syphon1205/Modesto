import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer } from "effect";

import { toPersistenceSqlError } from "../Errors.ts";
import {
  CheckpointDiffBlob,
  CheckpointDiffBlobStore,
  DeleteCheckpointDiffBlobsAfterTurnCountInput,
  GetCheckpointDiffBlobInput,
  type CheckpointDiffBlobStoreShape,
} from "../Services/CheckpointDiffBlobs.ts";

const makeCheckpointDiffBlobStore = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertCheckpointDiffBlobRow = SqlSchema.void({
    Request: CheckpointDiffBlob,
    execute: (row) =>
      sql`
        INSERT INTO checkpoint_diff_blobs (
          thread_id,
          from_turn_count,
          to_turn_count,
          diff,
          created_at
        )
        VALUES (
          ${row.threadId},
          ${row.fromTurnCount},
          ${row.toTurnCount},
          ${row.diff},
          ${row.createdAt}
        )
        ON CONFLICT (thread_id, from_turn_count, to_turn_count)
        DO UPDATE SET
          diff = excluded.diff,
          created_at = excluded.created_at
      `,
  });

  const getCheckpointDiffBlobRow = SqlSchema.findOneOption({
    Request: GetCheckpointDiffBlobInput,
    Result: CheckpointDiffBlob,
    execute: ({ threadId, fromTurnCount, toTurnCount }) =>
      sql`
        SELECT
          thread_id AS "threadId",
          from_turn_count AS "fromTurnCount",
          to_turn_count AS "toTurnCount",
          diff,
          created_at AS "createdAt"
        FROM checkpoint_diff_blobs
        WHERE thread_id = ${threadId}
          AND from_turn_count = ${fromTurnCount}
          AND to_turn_count = ${toTurnCount}
      `,
  });

  const deleteCheckpointDiffBlobRowsAfterTurnCount = SqlSchema.void({
    Request: DeleteCheckpointDiffBlobsAfterTurnCountInput,
    execute: ({ threadId, turnCount }) =>
      sql`
        DELETE FROM checkpoint_diff_blobs
        WHERE thread_id = ${threadId}
          AND to_turn_count > ${turnCount}
      `,
  });

  const upsert: CheckpointDiffBlobStoreShape["upsert"] = (row) =>
    upsertCheckpointDiffBlobRow(row).pipe(
      Effect.mapError(toPersistenceSqlError("CheckpointDiffBlobStore.upsert:query")),
    );

  const getByTurnRange: CheckpointDiffBlobStoreShape["getByTurnRange"] = (input) =>
    getCheckpointDiffBlobRow(input).pipe(
      Effect.mapError(toPersistenceSqlError("CheckpointDiffBlobStore.getByTurnRange:query")),
    );

  const deleteAfterTurnCount: CheckpointDiffBlobStoreShape["deleteAfterTurnCount"] = (input) =>
    deleteCheckpointDiffBlobRowsAfterTurnCount(input).pipe(
      Effect.mapError(toPersistenceSqlError("CheckpointDiffBlobStore.deleteAfterTurnCount:query")),
    );

  return {
    upsert,
    getByTurnRange,
    deleteAfterTurnCount,
  } satisfies CheckpointDiffBlobStoreShape;
});

export const CheckpointDiffBlobStoreLive = Layer.effect(
  CheckpointDiffBlobStore,
  makeCheckpointDiffBlobStore,
);
