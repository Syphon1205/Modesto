import { assert, it } from "@effect/vitest";
import { ThreadId, type OrchestrationEvent } from "@modesto/contracts";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

import { awaitTurnSettled } from "./AutomationTurnDispatcher.ts";

const THREAD_ID = ThreadId.make("thread-automation");
const OTHER_THREAD_ID = ThreadId.make("thread-someone-else");

let sequence = 0;

function sessionSet(input: {
  readonly threadId: ThreadId;
  readonly activeTurnId: string | null;
  readonly lastError?: string | null;
}): OrchestrationEvent {
  sequence += 1;
  return {
    eventId: `event-${sequence}`,
    sequence,
    type: "thread.session-set",
    aggregate: { kind: "thread", id: input.threadId },
    actor: { kind: "server" },
    metadata: {},
    createdAt: new Date(1_780_000_000_000 + sequence).toISOString(),
    payload: {
      threadId: input.threadId,
      session: {
        threadId: input.threadId,
        status: "ready",
        providerName: "codex",
        runtimeMode: "auto",
        activeTurnId: input.activeTurnId,
        lastError: input.lastError ?? null,
        updatedAt: new Date(1_780_000_000_000 + sequence).toISOString(),
      },
    },
  } as unknown as OrchestrationEvent;
}

it.effect("reports success once the turn that started has finished", () =>
  Effect.gen(function* () {
    const events = Stream.fromArray([
      // Thread creation reports no active turn; treating that as completion
      // would settle the run before it ever started.
      sessionSet({ threadId: THREAD_ID, activeTurnId: null }),
      sessionSet({ threadId: THREAD_ID, activeTurnId: "turn-1" }),
      sessionSet({ threadId: THREAD_ID, activeTurnId: null }),
    ]);

    const outcome = yield* awaitTurnSettled(events, THREAD_ID, 60_000);

    assert.strictEqual(outcome.status, "succeeded");
    assert.strictEqual(outcome.error, null);
  }),
);

it.effect("reports the session's error when the turn ends badly", () =>
  Effect.gen(function* () {
    const events = Stream.fromArray([
      sessionSet({ threadId: THREAD_ID, activeTurnId: "turn-1" }),
      sessionSet({ threadId: THREAD_ID, activeTurnId: null, lastError: "provider exited" }),
    ]);

    const outcome = yield* awaitTurnSettled(events, THREAD_ID, 60_000);

    assert.strictEqual(outcome.status, "failed");
    assert.strictEqual(outcome.error?.message, "provider exited");
  }),
);

it.effect("ignores other threads' sessions", () =>
  Effect.gen(function* () {
    const events = Stream.fromArray([
      sessionSet({ threadId: OTHER_THREAD_ID, activeTurnId: "turn-x" }),
      sessionSet({ threadId: OTHER_THREAD_ID, activeTurnId: null }),
      sessionSet({ threadId: THREAD_ID, activeTurnId: "turn-1" }),
      sessionSet({ threadId: THREAD_ID, activeTurnId: null }),
    ]);

    const outcome = yield* awaitTurnSettled(events, THREAD_ID, 60_000);

    assert.strictEqual(outcome.status, "succeeded");
  }),
);

it.effect("times out rather than waiting on a turn that never settles", () =>
  Effect.gen(function* () {
    const events = Stream.fromArray([
      sessionSet({ threadId: THREAD_ID, activeTurnId: "turn-1" }),
    ]).pipe(
      // A stream that never ends and never settles the turn.
      Stream.concat(Stream.never),
    );

    // The timeout is measured on Effect's clock, which under `it.effect` is
    // the TestClock - so it has to be moved by hand, with the wait already in
    // flight on its own fiber.
    const waiting = yield* Effect.forkChild(awaitTurnSettled(events, THREAD_ID, 25));
    yield* TestClock.adjust(Duration.millis(50));
    const outcome = yield* Fiber.join(waiting);

    assert.strictEqual(outcome.status, "failed");
    assert.strictEqual(outcome.error?.code, "execution_timed_out");
    // The turn is not cancelled by the timeout, and the message says so.
    assert.match(outcome.error?.message ?? "", /may still be running/);
  }),
);
