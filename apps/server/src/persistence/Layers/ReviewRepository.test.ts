import { assert, it } from "@effect/vitest";
import { ProjectId, ReviewRunId, ThreadId, type ReviewRun } from "@modesto/contracts";
import { Effect, Layer, Option } from "effect";

import { ReviewRepository } from "../Services/ReviewRepository.ts";
import { SqlitePersistenceMemory } from "./Sqlite.ts";
import { ReviewRepositoryLive } from "./ReviewRepository.ts";

const layer = it.layer(ReviewRepositoryLive.pipe(Layer.provideMerge(SqlitePersistenceMemory)));

layer("ReviewRepository", (it) => {
  it.effect("round-trips review target, runtime configuration, and summary", () =>
    Effect.gen(function* () {
      const repository = yield* ReviewRepository;
      const run: ReviewRun = {
        id: ReviewRunId.makeUnsafe("review-run:metadata"),
        threadId: ThreadId.makeUnsafe("thread:metadata"),
        projectId: ProjectId.makeUnsafe("project:metadata"),
        provider: "modesto",
        status: "completed",
        target: {
          type: "selectedCode",
          file: "src/review.ts",
          startLine: 12,
          endLine: 24,
        },
        configuration: {
          runtime: "cursor",
          model: "auto",
          depth: "deep",
          includeSecurity: true,
          includePerformance: true,
          includeArchitecture: true,
          includeTestCoverage: true,
          allowFixSuggestions: true,
          instructionFiles: ["AGENTS.md"],
        },
        findingCount: 2,
        summary: "Two actionable findings.",
        error: null,
        startedAt: "2026-07-23T20:00:00.000Z",
        finishedAt: "2026-07-23T20:01:00.000Z",
        createdAt: "2026-07-23T20:00:00.000Z",
        updatedAt: "2026-07-23T20:01:00.000Z",
      };

      yield* repository.createRun(run);

      const stored = yield* repository.getRun(run.id);
      assert.isTrue(Option.isSome(stored));
      if (Option.isSome(stored)) {
        assert.deepStrictEqual(stored.value, run);
      }
      assert.deepStrictEqual(yield* repository.listRuns(run.threadId), [run]);
    }),
  );

  it.effect("does not overwrite a cancelled run with a late terminal result", () =>
    Effect.gen(function* () {
      const repository = yield* ReviewRepository;
      const now = "2026-07-23T20:00:00.000Z";
      const run: ReviewRun = {
        id: ReviewRunId.makeUnsafe("review-run:cancel-race"),
        threadId: ThreadId.makeUnsafe("thread:cancel-race"),
        projectId: ProjectId.makeUnsafe("project:cancel-race"),
        provider: "modesto",
        status: "running",
        target: { type: "uncommittedChanges" },
        configuration: null,
        findingCount: 0,
        summary: null,
        error: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      yield* repository.createRun(run);
      const cancelled = yield* repository.saveRun({
        ...run,
        status: "cancelled",
        finishedAt: now,
      });
      const terminal = yield* repository.saveRunIfActive({
        ...run,
        status: "completed",
        summary: "Late completion.",
        finishedAt: now,
      });

      assert.deepStrictEqual(terminal, cancelled);
    }),
  );

  it.effect("does not overwrite a completed run with a late cancellation", () =>
    Effect.gen(function* () {
      const repository = yield* ReviewRepository;
      const now = "2026-07-23T20:00:00.000Z";
      const run: ReviewRun = {
        id: ReviewRunId.makeUnsafe("review-run:late-cancel"),
        threadId: ThreadId.makeUnsafe("thread:late-cancel"),
        projectId: ProjectId.makeUnsafe("project:late-cancel"),
        provider: "modesto",
        status: "running",
        target: { type: "uncommittedChanges" },
        configuration: null,
        findingCount: 0,
        summary: null,
        error: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      yield* repository.createRun(run);
      const completed = yield* repository.saveRunIfActive({
        ...run,
        status: "completed",
        summary: "Complete.",
        finishedAt: now,
      });
      const lateCancel = yield* repository.saveRunIfActive({
        ...run,
        status: "cancelled",
        finishedAt: now,
      });

      assert.deepStrictEqual(lateCancel, completed);
    }),
  );

  it.effect("preserves a late finding count after cancellation", () =>
    Effect.gen(function* () {
      const repository = yield* ReviewRepository;
      const now = "2026-07-23T20:00:00.000Z";
      const run: ReviewRun = {
        id: ReviewRunId.makeUnsafe("review-run:cancel-count"),
        threadId: ThreadId.makeUnsafe("thread:cancel-count"),
        projectId: ProjectId.makeUnsafe("project:cancel-count"),
        provider: "modesto",
        status: "running",
        target: { type: "uncommittedChanges" },
        configuration: null,
        findingCount: 0,
        summary: null,
        error: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      yield* repository.createRun(run);
      yield* repository.saveRunIfActive({ ...run, status: "cancelled", finishedAt: now });
      const finalized = yield* repository.saveRunIfActive({
        ...run,
        status: "cancelled",
        findingCount: 2,
        finishedAt: now,
      });

      assert.strictEqual(finalized.status, "cancelled");
      assert.strictEqual(finalized.findingCount, 2);
    }),
  );

  it.effect("fails active runs left behind by a previous server process", () =>
    Effect.gen(function* () {
      const repository = yield* ReviewRepository;
      const startedAt = "2026-07-23T20:00:00.000Z";
      const recoveredAt = "2026-07-23T20:05:00.000Z";
      const run: ReviewRun = {
        id: ReviewRunId.makeUnsafe("review-run:stale"),
        threadId: ThreadId.makeUnsafe("thread:stale"),
        projectId: ProjectId.makeUnsafe("project:stale"),
        provider: "modesto",
        status: "running",
        target: { type: "repository" },
        configuration: null,
        findingCount: 0,
        summary: null,
        error: null,
        startedAt,
        finishedAt: null,
        createdAt: startedAt,
        updatedAt: startedAt,
      };

      yield* repository.createRun(run);
      yield* repository.failStaleActiveRuns(recoveredAt);
      const recovered = yield* repository.getRun(run.id);

      assert.isTrue(Option.isSome(recovered));
      if (Option.isSome(recovered)) {
        assert.strictEqual(recovered.value.status, "failed");
        assert.strictEqual(
          recovered.value.error,
          "Review interrupted by a previous Modesto shutdown.",
        );
        assert.strictEqual(recovered.value.finishedAt, recoveredAt);
      }
    }),
  );
});
