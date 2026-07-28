import { ThreadId } from "@modesto/contracts";
import { assert, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";

import { SqlitePersistenceMemory } from "./Sqlite.ts";
import { CheckpointDiffBlobStoreLive } from "./CheckpointDiffBlobs.ts";
import { CheckpointDiffBlobStore } from "../Services/CheckpointDiffBlobs.ts";

const checkpointDiffBlobsLayer = it.layer(
  Layer.mergeAll(
    CheckpointDiffBlobStoreLive.pipe(Layer.provideMerge(SqlitePersistenceMemory)),
    SqlitePersistenceMemory,
  ),
);

checkpointDiffBlobsLayer("CheckpointDiffBlobStore", (it) => {
  it.effect("round-trips a stored diff blob by (threadId, fromTurnCount, toTurnCount)", () =>
    Effect.gen(function* () {
      const store = yield* CheckpointDiffBlobStore;
      const threadId = ThreadId.makeUnsafe("thread-blob-1");

      yield* store.upsert({
        threadId,
        fromTurnCount: 0,
        toTurnCount: 1,
        diff: "diff --git a/file.txt b/file.txt",
        createdAt: "2026-03-24T00:00:00.000Z",
      });

      const found = yield* store.getByTurnRange({
        threadId,
        fromTurnCount: 0,
        toTurnCount: 1,
      });
      assert.deepStrictEqual(Option.getOrNull(found)?.diff, "diff --git a/file.txt b/file.txt");

      const missing = yield* store.getByTurnRange({
        threadId,
        fromTurnCount: 1,
        toTurnCount: 2,
      });
      assert.strictEqual(Option.isNone(missing), true);
    }),
  );

  it.effect("upsert overwrites the diff text for the same turn range", () =>
    Effect.gen(function* () {
      const store = yield* CheckpointDiffBlobStore;
      const threadId = ThreadId.makeUnsafe("thread-blob-2");

      yield* store.upsert({
        threadId,
        fromTurnCount: 0,
        toTurnCount: 1,
        diff: "first diff",
        createdAt: "2026-03-24T00:00:00.000Z",
      });
      yield* store.upsert({
        threadId,
        fromTurnCount: 0,
        toTurnCount: 1,
        diff: "second diff",
        createdAt: "2026-03-24T00:00:01.000Z",
      });

      const found = yield* store.getByTurnRange({
        threadId,
        fromTurnCount: 0,
        toTurnCount: 1,
      });
      assert.deepStrictEqual(Option.getOrNull(found)?.diff, "second diff");
    }),
  );

  it.effect("deleteAfterTurnCount drops only rows past the given turn count", () =>
    Effect.gen(function* () {
      const store = yield* CheckpointDiffBlobStore;
      const threadId = ThreadId.makeUnsafe("thread-blob-3");

      yield* store.upsert({
        threadId,
        fromTurnCount: 0,
        toTurnCount: 1,
        diff: "turn 1 diff",
        createdAt: "2026-03-24T00:00:00.000Z",
      });
      yield* store.upsert({
        threadId,
        fromTurnCount: 1,
        toTurnCount: 2,
        diff: "turn 2 diff",
        createdAt: "2026-03-24T00:00:01.000Z",
      });

      yield* store.deleteAfterTurnCount({ threadId, turnCount: 1 });

      const stillPresent = yield* store.getByTurnRange({
        threadId,
        fromTurnCount: 0,
        toTurnCount: 1,
      });
      assert.strictEqual(Option.isSome(stillPresent), true);

      const dropped = yield* store.getByTurnRange({
        threadId,
        fromTurnCount: 1,
        toTurnCount: 2,
      });
      assert.strictEqual(Option.isNone(dropped), true);
    }),
  );
});
