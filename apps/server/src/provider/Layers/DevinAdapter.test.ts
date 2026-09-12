import * as NodeAssert from "node:assert/strict";

import * as NodeServices from "@effect/platform-node/NodeServices";
import type * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { describe, it } from "vite-plus/test";

import { DevinSettings, ThreadId } from "@modesto/contracts";

import { makeDevinAdapter, type DevinFetch } from "./DevinAdapter.ts";

const decodeDevinSettings = Schema.decodeSync(DevinSettings);

/**
 * Runs against the real clock deliberately: the adapter's polling loop sleeps
 * between `GET /sessions/{id}` calls, and `@effect/vitest`'s `it.effect` would
 * put it on the TestClock, where those sleeps never elapse.
 */
const runNode = <A, E>(effect: Effect.Effect<A, E, Crypto.Crypto>): Promise<A> =>
  Effect.runPromise(effect.pipe(Effect.provide(NodeServices.layer)));

interface RecordedCall {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

/**
 * Minimal stand-in for Devin's REST API: `POST /sessions` mints a session,
 * `POST /sessions/{id}/message` appends to an existing one, and `GET` returns
 * the transcript. Answering `finished` on the first poll keeps the adapter's
 * polling loop to a single iteration.
 */
function makeDevinApiDouble() {
  const calls: Array<RecordedCall> = [];
  let messageCounter = 0;
  const messages: Array<{
    type: string;
    event_id: string;
    message: string;
    timestamp: string;
  }> = [];

  const fetchImplementation: DevinFetch = async (input, init) => {
    const url = new URL(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname, body });

    if (method === "POST" && url.pathname === "/v1/sessions") {
      messageCounter += 1;
      messages.push({
        type: "devin_message",
        event_id: `evt-${messageCounter}`,
        message: "On it.",
        timestamp: new Date().toISOString(),
      });
      return new Response(JSON.stringify({ session_id: "sess-1" }), { status: 200 });
    }

    if (method === "POST" && url.pathname === "/v1/sessions/sess-1/message") {
      messageCounter += 1;
      messages.push({
        type: "devin_message",
        event_id: `evt-${messageCounter}`,
        message: "Following up.",
        timestamp: new Date().toISOString(),
      });
      return new Response("", { status: 200 });
    }

    if (method === "GET" && url.pathname === "/v1/sessions/sess-1") {
      return new Response(
        JSON.stringify({ session_id: "sess-1", status_enum: "finished", messages }),
        { status: 200 },
      );
    }

    return new Response("not found", { status: 404 });
  };

  return { calls, fetchImplementation };
}

const settings = decodeDevinSettings({ enabled: true, apiBaseUrl: "https://devin.test/v1" });

describe("DevinAdapter", () => {
  it("creates the remote session lazily on the first turn, then messages it", () =>
    runNode(
      Effect.gen(function* () {
        const api = makeDevinApiDouble();
        const adapter = yield* makeDevinAdapter(settings, {
          environment: { DEVIN_API_KEY: "test-key" },
          pollIntervalMs: 1,
          fetchImplementation: api.fetchImplementation,
        });
        const threadId = ThreadId.make("thread-devin-1");

        yield* adapter.startSession({ threadId, runtimeMode: "auto" });
        // Nothing remote yet: Devin has no "create an empty session" endpoint.
        NodeAssert.equal(api.calls.length, 0);

        yield* adapter.sendTurn({ threadId, input: "Ship the thing" });

        // 2 session events + turn.started, item.started, content.delta,
        // item.completed, turn.completed.
        const collected = yield* adapter.streamEvents.pipe(
          Stream.take(7),
          Stream.runCollect,
          Effect.timeoutOption(10_000),
        );
        const events = collected._tag === "Some" ? collected.value : [];

        NodeAssert.deepEqual(
          events.map((event) => event.type),
          [
            "session.started",
            "session.configured",
            "turn.started",
            "item.started",
            "content.delta",
            "item.completed",
            "turn.completed",
          ],
        );
        const delta = events.find((event) => event.type === "content.delta");
        NodeAssert.equal(
          delta && "delta" in delta.payload ? delta.payload.delta : undefined,
          "On it.",
        );
        NodeAssert.deepEqual(
          api.calls.map((call) => `${call.method} ${call.path}`),
          ["POST /v1/sessions", "GET /v1/sessions/sess-1"],
        );

        // The second turn must reuse the session Devin already minted.
        yield* adapter.sendTurn({ threadId, input: "Now the follow-up" });
        yield* adapter.streamEvents.pipe(
          Stream.take(5),
          Stream.runCollect,
          Effect.timeoutOption(10_000),
        );
        NodeAssert.equal(api.calls[2]?.method, "POST");
        NodeAssert.equal(api.calls[2]?.path, "/v1/sessions/sess-1/message");
        NodeAssert.deepEqual(api.calls[2]?.body, { message: "Now the follow-up" });

        yield* adapter.stopSession(threadId);
      }),
    ));

  it("fails a turn with an actionable message when no API key is configured", () =>
    runNode(
      Effect.gen(function* () {
        const api = makeDevinApiDouble();
        const adapter = yield* makeDevinAdapter(settings, {
          environment: {},
          pollIntervalMs: 1,
          fetchImplementation: api.fetchImplementation,
        });
        const threadId = ThreadId.make("thread-devin-2");

        yield* adapter.startSession({ threadId, runtimeMode: "auto" });
        yield* adapter.sendTurn({ threadId, input: "Ship the thing" });

        // 2 session events + runtime.error + turn.completed: a key-less turn
        // never reaches Devin, so there is no item/content pair.
        const collected = yield* adapter.streamEvents.pipe(
          Stream.take(4),
          Stream.runCollect,
          Effect.timeoutOption(10_000),
        );
        const events = collected._tag === "Some" ? collected.value : [];
        const failure = events.find((event) => event.type === "runtime.error");

        NodeAssert.ok(failure, "expected a runtime.error event");
        NodeAssert.ok(
          failure &&
            "message" in failure.payload &&
            String(failure.payload.message).includes("DEVIN_API_KEY is not set"),
        );
        NodeAssert.equal(api.calls.length, 0);
      }),
    ));
});
