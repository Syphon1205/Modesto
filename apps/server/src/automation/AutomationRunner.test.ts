import { assert, it } from "@effect/vitest";
import type { AutomationRepository, AutomationRun } from "@modesto/openwork-automations";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";

import { SqlitePersistenceMemory } from "../persistence/Layers/Sqlite.ts";
import { createSqliteAutomationRepository } from "./SqliteAutomationRepository.ts";
import {
  makeAutomationRunner,
  type AutomationDispatchOutcome,
  type AutomationDispatcher,
} from "./AutomationRunner.ts";

const ORGANIZATION_ID = "org_local";
const OWNER_MEMBER_ID = "member_local";

const UNKNOWN_USAGE = { inputTokens: null, outputTokens: null, costMicros: null };

const succeed = (summary: string): AutomationDispatchOutcome => ({
  status: "succeeded",
  resultSummary: summary,
  usage: UNKNOWN_USAGE,
  error: null,
});

/** Records what it was asked to run so a test can assert on dispatch. */
function makeRecordingDispatcher(
  outcome: (input: { readonly runId: string }) => AutomationDispatchOutcome = () => succeed("done"),
): AutomationDispatcher & { readonly runIds: string[] } {
  const runIds: string[] = [];
  return {
    runIds,
    run: (input) =>
      Effect.sync(() => {
        runIds.push(input.run.id);
        return outcome({ runId: input.run.id });
      }),
  };
}

const repositoryFor = Effect.fn("repositoryFor")(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* TestClock.setTime(Date.now());
  return createSqliteAutomationRepository({ sql, run: (effect) => Effect.runPromise(effect) });
});

/**
 * An automation whose one occurrence has already come due by the time the
 * runner ticks.
 *
 * `nextDueAt` is computed from the schedule relative to the creation time, so
 * the row is created in the past with an occurrence between then and now: a
 * schedule already in the past at creation yields no occurrence at all.
 */
const createDueAutomation = (repository: AutomationRepository) =>
  Effect.promise(() => {
    const createdAt = Date.now() - 60_000;
    return Promise.resolve(
      repository.create({
        organizationId: ORGANIZATION_ID,
        ownerMemberId: OWNER_MEMBER_ID,
        definition: {
          name: "Morning digest",
          instructions: "Summarize what changed overnight.",
          schedule: { kind: "once", timezone: "UTC", at: createdAt + 30_000 },
          model: { providerId: "codex", modelId: "gpt-5.6-sol" },
        },
        now: createdAt,
      }),
    );
  });

const layer = it.layer(SqlitePersistenceMemory);

/**
 * Every test starts by pointing the TestClock at wall-clock time.
 *
 * The runner asks Effect's `Clock` what time it is - correct in production, but
 * `it.effect` runs on the TestClock, which starts at epoch 0. Left alone,
 * nothing is ever due and every assertion below would pass or fail for the
 * wrong reason. `atWallClock` makes "now" mean now.
 */
layer("AutomationRunner", (it) => {
  it.effect("claims a due automation, runs it, and records the result", () =>
    Effect.gen(function* () {
      const repository = yield* repositoryFor();
      const created = yield* createDueAutomation(repository);
      const dispatcher = makeRecordingDispatcher(() => succeed("digest sent"));

      const runner = makeAutomationRunner({
        repository,
        dispatcher,
        leaseOwner: "runner-a",
      });
      const report = yield* runner.tickOnce;

      assert.strictEqual(report.claimed, 1);
      assert.strictEqual(report.dispatched[0]?.automationId, created.automation.id);
      // A tick returns once the run is handed off; the run itself is a fiber.
      yield* Fiber.join(report.dispatched[0]!.fiber);

      const runs = yield* Effect.promise(() =>
        Promise.resolve(
          repository.listRuns({
            organizationId: ORGANIZATION_ID,
            ownerMemberId: OWNER_MEMBER_ID,
            automationId: created.automation.id,
            limit: 10,
          }),
        ),
      );
      const settled = runs.items[0] as AutomationRun;
      assert.strictEqual(settled.status, "succeeded");
      assert.strictEqual(settled.resultSummary, "digest sent");
      assert.deepStrictEqual(dispatcher.runIds, [settled.id]);
    }),
  );

  it.effect("a second runner does not double-run the same occurrence", () =>
    Effect.gen(function* () {
      const repository = yield* repositoryFor();
      yield* createDueAutomation(repository);

      const first = makeRecordingDispatcher();
      const second = makeRecordingDispatcher();

      // The claim is won in the database, so the loser sees `duplicate` and
      // skips rather than failing - this is the race two replicas actually hit.
      const firstReport = yield* makeAutomationRunner({
        repository,
        dispatcher: first,
        leaseOwner: "runner-a",
      }).tickOnce;
      const secondReport = yield* makeAutomationRunner({
        repository,
        dispatcher: second,
        leaseOwner: "runner-b",
      }).tickOnce;

      yield* Effect.forEach(firstReport.dispatched, (entry) => Fiber.join(entry.fiber));

      assert.strictEqual(firstReport.claimed, 1);
      assert.strictEqual(secondReport.claimed, 0);
      assert.strictEqual(first.runIds.length, 1);
      assert.strictEqual(second.runIds.length, 0);
    }),
  );

  it.effect("records a failed dispatch as a failed run rather than losing it", () =>
    Effect.gen(function* () {
      const repository = yield* repositoryFor();
      const created = yield* createDueAutomation(repository);

      const runner = makeAutomationRunner({
        repository,
        leaseOwner: "runner-a",
        dispatcher: {
          run: () => Effect.die(new Error("provider exploded")),
        },
      });
      const report = yield* runner.tickOnce;
      yield* Effect.forEach(report.dispatched, (entry) => Fiber.join(entry.fiber));

      const runs = yield* Effect.promise(() =>
        Promise.resolve(
          repository.listRuns({
            organizationId: ORGANIZATION_ID,
            ownerMemberId: OWNER_MEMBER_ID,
            automationId: created.automation.id,
            limit: 10,
          }),
        ),
      );
      const settled = runs.items[0] as AutomationRun;
      assert.strictEqual(settled.status, "failed");
      assert.strictEqual(settled.error?.code, "execution_runtime_unavailable");
      // A runtime that was missing once may be back next time.
      assert.strictEqual(settled.error?.retryable, true);
    }),
  );

  it.effect("deduplicates webhook deliveries and passes their payload to the turn", () =>
    Effect.gen(function* () {
      const repository = yield* repositoryFor();
      const now = Date.now();
      const created = yield* Effect.promise(() =>
        Promise.resolve(
          repository.create({
            organizationId: ORGANIZATION_ID,
            ownerMemberId: OWNER_MEMBER_ID,
            definition: {
              name: "Webhook review",
              instructions: "Review the incoming event.",
              schedule: { kind: "once", timezone: "UTC", at: now + 86_400_000 },
              model: { providerId: "codex", modelId: "gpt-5.6-sol" },
            },
            now,
          }),
        ),
      );
      const instructions: string[] = [];
      const runner = makeAutomationRunner({
        repository,
        leaseOwner: "runner-webhook",
        dispatcher: {
          run: ({ revision }) =>
            Effect.sync(() => {
              instructions.push(revision.instructions);
              return succeed("handled");
            }),
        },
      });

      const first = yield* runner.triggerOnce(created, {
        trigger: "webhook",
        nonce: "delivery-123",
        context: { payload: { action: "opened" } },
      });
      assert.strictEqual(first.kind, "claimed");
      if (first.kind === "claimed") yield* Fiber.join(first.dispatched.fiber);

      const duplicate = yield* runner.triggerOnce(created, {
        trigger: "webhook",
        nonce: "delivery-123",
        context: { payload: { action: "opened" } },
      });
      assert.strictEqual(duplicate.kind, "duplicate");
      assert.strictEqual(instructions.length, 1);
      assert.match(instructions[0]!, /"action": "opened"/);

      const runs = yield* Effect.promise(() =>
        Promise.resolve(
          repository.listRuns({
            organizationId: ORGANIZATION_ID,
            ownerMemberId: OWNER_MEMBER_ID,
            automationId: created.automation.id,
            limit: 10,
          }),
        ),
      );
      assert.strictEqual(runs.items[0]?.trigger, "webhook");
    }),
  );

  it.effect("leaves an automation that is not due alone", () =>
    Effect.gen(function* () {
      const repository = yield* repositoryFor();
      const now = Date.now();
      yield* Effect.promise(() =>
        Promise.resolve(
          repository.create({
            organizationId: ORGANIZATION_ID,
            ownerMemberId: OWNER_MEMBER_ID,
            definition: {
              name: "Later",
              instructions: "Not yet.",
              schedule: { kind: "once", timezone: "UTC", at: now + 60 * 60 * 1_000 },
              model: { providerId: "codex", modelId: "gpt-5.6-sol" },
            },
            now,
          }),
        ),
      );
      const dispatcher = makeRecordingDispatcher();

      const report = yield* makeAutomationRunner({
        repository,
        dispatcher,
        leaseOwner: "runner-a",
      }).tickOnce;

      assert.strictEqual(report.claimed, 0);
      assert.strictEqual(dispatcher.runIds.length, 0);
    }),
  );

  it.effect("takes over an expired lease and redispatches the crashed run", () =>
    Effect.gen(function* () {
      const repository = yield* repositoryFor();
      const created = yield* createDueAutomation(repository);
      const hanging: AutomationDispatcher = { run: () => Effect.never };

      const first = makeAutomationRunner({
        repository,
        dispatcher: hanging,
        leaseOwner: "runner-crash",
        leaseMs: 1_000,
        heartbeatMs: 60_000,
      });
      const firstReport = yield* first.tickOnce;
      assert.strictEqual(firstReport.claimed, 1);
      yield* Fiber.interrupt(firstReport.dispatched[0]!.fiber);

      yield* TestClock.adjust(Duration.millis(2_000));

      const recoveredDispatcher = makeRecordingDispatcher(() => succeed("recovered"));
      const recovered = yield* makeAutomationRunner({
        repository,
        dispatcher: recoveredDispatcher,
        leaseOwner: "runner-recover",
        leaseMs: 1_000,
      }).tickOnce;
      assert.strictEqual(recovered.recovered, 1);
      yield* Effect.forEach(recovered.dispatched, (entry) => Fiber.join(entry.fiber));

      const runs = yield* Effect.promise(() =>
        Promise.resolve(
          repository.listRuns({
            organizationId: ORGANIZATION_ID,
            ownerMemberId: OWNER_MEMBER_ID,
            automationId: created.automation.id,
            limit: 10,
          }),
        ),
      );
      assert.strictEqual(runs.items[0]?.status, "succeeded");
      assert.strictEqual(runs.items[0]?.resultSummary, "recovered");
      assert.deepStrictEqual(recoveredDispatcher.runIds, [runs.items[0]?.id]);
    }),
  );

  it.effect("reclaims an expired webhook run on the same delivery nonce", () =>
    Effect.gen(function* () {
      const repository = yield* repositoryFor();
      const createdAt = Date.now();
      const created = yield* Effect.promise(() =>
        Promise.resolve(
          repository.create({
            organizationId: ORGANIZATION_ID,
            ownerMemberId: OWNER_MEMBER_ID,
            definition: {
              name: "Webhook recover",
              instructions: "Review the incoming event.",
              schedule: { kind: "once", timezone: "UTC", at: createdAt + 86_400_000 },
              model: { providerId: "codex", modelId: "gpt-5.6-sol" },
            },
            now: createdAt,
          }),
        ),
      );
      const hanging = makeAutomationRunner({
        repository,
        leaseOwner: "runner-webhook-crash",
        leaseMs: 1_000,
        heartbeatMs: 60_000,
        dispatcher: { run: () => Effect.never },
      });
      const first = yield* hanging.triggerOnce(created, {
        trigger: "webhook",
        nonce: "delivery-recover",
        context: { payload: { action: "opened" } },
      });
      assert.strictEqual(first.kind, "claimed");
      if (first.kind === "claimed") yield* Fiber.interrupt(first.dispatched.fiber);

      yield* TestClock.adjust(Duration.millis(2_000));

      const instructions: string[] = [];
      const recovered = yield* makeAutomationRunner({
        repository,
        leaseOwner: "runner-webhook-recover",
        leaseMs: 1_000,
        dispatcher: {
          run: ({ revision }) =>
            Effect.sync(() => {
              instructions.push(revision.instructions);
              return succeed("handled");
            }),
        },
      }).triggerOnce(created, {
        trigger: "webhook",
        nonce: "delivery-recover",
        context: { payload: { action: "opened" } },
      });
      assert.strictEqual(recovered.kind, "claimed");
      if (recovered.kind === "claimed") yield* Fiber.join(recovered.dispatched.fiber);
      assert.match(instructions[0]!, /"action": "opened"/);
    }),
  );
});
