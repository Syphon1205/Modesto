import { verifyAutomationRepositoryConformance } from "@modesto/openwork-automations/testing";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { SqlitePersistenceMemory } from "../persistence/Layers/Sqlite.ts";
import { createSqliteAutomationRepository } from "./SqliteAutomationRepository.ts";

const layer = it.layer(SqlitePersistenceMemory);

layer("SqliteAutomationRepository", (it) => {
  // Upstream's own definition of a correct repository, run against real SQL
  // rather than a fake. Covers transactional creation, durable revisions,
  // organization isolation, immutable revisions, and - the one that matters -
  // two replicas racing for a single occurrence.
  it.effect("passes the engine's repository conformance suite", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      // The port is Promise-based. Queries built from a client instance carry
      // their own connection and need no context, so the bridge is just
      // runPromise rather than reshaping upstream's interface.
      const repository = createSqliteAutomationRepository({
        sql,
        run: (effect) => Effect.runPromise(effect),
      });

      const checked = yield* Effect.promise(() =>
        verifyAutomationRepositoryConformance(repository),
      );

      assert.deepStrictEqual(checked, [
        "transactional active creation",
        "durable initial revision",
        "organization isolation",
        "immutable revisions",
        "scheduled and recovery claim deduplication",
      ]);
    }),
  );
});
