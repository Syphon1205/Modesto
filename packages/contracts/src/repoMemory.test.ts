import { ThreadHandoff } from "@modesto/contracts";
import { assert, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

const decodeThreadHandoff = Schema.decodeUnknownEffect(ThreadHandoff);

it.effect("legacy ThreadHandoff payloads decode with defaults for new fields", () =>
  Effect.gen(function* () {
    const decoded = yield* decodeThreadHandoff({
      sourceThreadId: "thread-old",
      sourceProvider: "codex",
      importedAt: "2026-01-01T00:00:00.000Z",
      bootstrapStatus: "pending",
    });

    assert.strictEqual(decoded.sourceThreadId, "thread-old");
    assert.strictEqual(decoded.sourceProvider, "codex");
    assert.strictEqual(decoded.bootstrapStatus, "pending");
    assert.isNull(decoded.summary);
    assert.isNull(decoded.objective);
    assert.deepEqual(decoded.unfinishedSteps, []);
    assert.isNull(decoded.repoSnapshot);
    assert.strictEqual(decoded.diffAckStatus, "not_required");
  }),
);
