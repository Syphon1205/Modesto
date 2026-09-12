import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";

import { SqlitePersistenceMemory } from "../persistence/Layers/Sqlite.ts";
import { makeAutomationService } from "./AutomationService.ts";
import { createSqliteAutomationRepository } from "./SqliteAutomationRepository.ts";

const serviceFor = Effect.fn("serviceFor")(function* () {
  const sql = yield* SqlClient.SqlClient;
  // The service reads Effect's clock when it stamps a create; under the
  // TestClock that is epoch 0, which the engine rejects as a timestamp.
  yield* TestClock.setTime(Date.now());
  return makeAutomationService(
    createSqliteAutomationRepository({ sql, run: (effect) => Effect.runPromise(effect) }),
  );
});

const dailyDigest = {
  name: "Morning digest",
  instructions: "Summarize what changed overnight.",
  schedule: { kind: "daily" as const, timezone: "UTC", hour: 9, minute: 0 },
  model: { providerId: "codex", modelId: "gpt-5.6-sol" },
};

it.layer(SqlitePersistenceMemory)("AutomationService", (it) => {
  it.effect("creates an automation that is active and scheduled", () =>
    Effect.gen(function* () {
      const service = yield* serviceFor();

      const created = yield* service.create(dailyDigest);

      assert.strictEqual(created.name, "Morning digest");
      assert.strictEqual(created.state, "active");
      // A schedule with no next occurrence would never run; the engine
      // computes one at creation.
      assert.notStrictEqual(created.nextDueAt, null);
      assert.strictEqual(created.latestRun, null);
    }),
  );

  it.effect("lists what was created, with its instructions and model", () =>
    Effect.gen(function* () {
      const service = yield* serviceFor();
      const created = yield* service.create(dailyDigest);

      // These tests share one database, so assertions look up the row they
      // made rather than counting the whole list.
      const listed = (yield* service.list()).automations.find(
        (automation) => automation.id === created.id,
      );

      assert.strictEqual(listed?.instructions, "Summarize what changed overnight.");
      assert.strictEqual(listed?.model.modelId, "gpt-5.6-sol");
    }),
  );

  it.effect("disabling stops it being listed as active, archiving hides it", () =>
    Effect.gen(function* () {
      const service = yield* serviceFor();
      const created = yield* service.create(dailyDigest);

      const isListed = Effect.map(service.list(), ({ automations }) =>
        automations.some((automation) => automation.id === created.id),
      );

      const paused = yield* service.setState({ automationId: created.id, state: "inactive" });
      assert.strictEqual(paused?.state, "inactive");
      // Inactive still shows - it is paused, not gone.
      assert.strictEqual(yield* isListed, true);

      yield* service.setState({ automationId: created.id, state: "archived" });
      assert.strictEqual(yield* isListed, false);
    }),
  );

  it.effect("reports a missing automation as null rather than failing", () =>
    Effect.gen(function* () {
      const service = yield* serviceFor();

      const missing = yield* service.setState({
        automationId: "automation_does_not_exist",
        state: "inactive",
      });

      assert.strictEqual(missing, null);
    }),
  );

  it.effect("returns an empty run history for an automation that never ran", () =>
    Effect.gen(function* () {
      const service = yield* serviceFor();
      const created = yield* service.create(dailyDigest);

      assert.deepStrictEqual(yield* service.runs({ automationId: created.id }), []);
    }),
  );
});
