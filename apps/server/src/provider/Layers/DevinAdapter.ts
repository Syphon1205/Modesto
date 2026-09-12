// FILE: DevinAdapter.ts
// Purpose: ProviderAdapter for Devin (Cognition), ported from the primary
//          Modesto tree's DevinAdapter.ts. Devin is the one provider in this
//          tree with no local process at all: no CLI, no ACP handshake, no
//          stdio. Modesto talks to Devin's documented v1 REST API
//          (https://docs.devin.ai/api-reference/overview) with the API key
//          taken from this instance's environment (`DEVIN_API_KEY`).
//
//          Two things about Devin's API shape drive this file's structure,
//          both carried over verbatim from the source implementation:
//
//          1. Session creation is not separable from the first message.
//             `POST /sessions` REQUIRES a prompt, and there is no
//             "create an empty session" endpoint - so `startSession` only
//             registers local bookkeeping and the remote session is created
//             lazily on the thread's FIRST `sendTurn`. Every later turn posts
//             to `/sessions/{id}/message`.
//          2. There is no streaming. Each turn forks a polling fiber into the
//             session's scope that calls `GET /sessions/{id}` on an interval
//             and, for each Devin-originated message it has not seen before,
//             emits one item.started -> content.delta (the whole message, as
//             there is nothing finer-grained to stream) -> item.completed
//             sequence, then turn.completed once `status_enum` settles.
//
// Deliberately NOT supported, because Devin's REST API has no confirmed
// equivalent and this adapter does not fake one (same list the source file
// carries):
//  - turn-level cancellation. Only whole-session termination exists, so
//    `interruptTurn` stops Modesto's polling locally and does not DELETE.
//  - structured approval / user-input responses. Best effort: posted as a
//    plain follow-up message when a remote session already exists.
//  - thread rollback, in-session model switching, skill/plugin discovery, and
//    file attachments (Devin's message endpoint is text-only - attachments
//    are reported to the user in the prompt rather than silently dropped).
//
// NOT verified live: no Devin API key is available in this migration tree, so
// every request shape here traces back to the source implementation and
// Devin's published API reference, not to an observed exchange.
// @module provider/Layers/DevinAdapter
import {
  EventId,
  ProviderDriverKind,
  ProviderInstanceId,
  RuntimeItemId,
  TurnId,
  type ApprovalRequestId,
  type DevinSettings,
  type ProviderApprovalDecision,
  type ProviderRuntimeEvent,
  type ProviderSession,
  type ProviderTurnStartResult,
  type ProviderUserInputAnswers,
  type ThreadId,
} from "@modesto/contracts";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Queue from "effect/Queue";
import * as Result from "effect/Result";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";

import {
  ProviderAdapterRequestError,
  ProviderAdapterSessionClosedError,
  ProviderAdapterSessionNotFoundError,
  ProviderAdapterValidationError,
} from "../Errors.ts";
import { type DevinAdapterShape } from "../Services/DevinAdapter.ts";
import type {
  ProviderThreadSnapshot,
  ProviderThreadTurnSnapshot,
} from "../Services/ProviderAdapter.ts";
import type { EventNdjsonLogger } from "./EventNdjsonLogger.ts";

const PROVIDER = ProviderDriverKind.make("devin");

export const DEVIN_API_KEY_ENV = "DEVIN_API_KEY";
export const DEVIN_DEFAULT_API_BASE_URL = "https://api.devin.ai/v1";
const DEVIN_POLL_INTERVAL_MS = 2_000;
const DEVIN_REQUEST_TIMEOUT_MS = 15_000;

/**
 * The slice of `fetch` this adapter actually uses. Narrower than `typeof
 * fetch` on purpose: tests substitute a plain function, and the global's
 * extra surface (`preconnect`, `Request` inputs) is neither used nor worth
 * forcing a double-cast for.
 */
export type DevinFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface DevinAdapterLiveOptions {
  readonly environment?: NodeJS.ProcessEnv;
  readonly nativeEventLogger?: EventNdjsonLogger;
  readonly instanceId?: ProviderInstanceId;
  /** Overridable for tests only — production always uses the 2s default. */
  readonly pollIntervalMs?: number;
  /** Overridable for tests only — production uses global `fetch`. */
  readonly fetchImplementation?: DevinFetch;
}

// ── Devin REST API shapes (https://docs.devin.ai/api-reference) ───────────

interface DevinCreateSessionResponse {
  readonly session_id: string;
  readonly url?: string;
  readonly is_new_session?: boolean | null;
}

type DevinStatusEnum =
  | "working"
  | "blocked"
  | "expired"
  | "finished"
  | "suspend_requested"
  | "suspend_requested_frontend"
  | "resume_requested"
  | "resume_requested_frontend"
  | "resumed";

interface DevinMessage {
  readonly type: string;
  readonly event_id: string;
  readonly message: string;
  readonly timestamp: string;
  readonly origin?: string | null;
  readonly user_id?: string | null;
  readonly username?: string | null;
}

interface DevinSessionDetails {
  readonly session_id: string;
  readonly status_enum?: DevinStatusEnum;
  readonly messages?: ReadonlyArray<DevinMessage>;
  readonly structured_output?: unknown;
  readonly title?: string | null;
}

const DEVIN_TERMINAL_STATUSES = new Set<DevinStatusEnum>(["finished", "expired"]);

function isDevinTerminalStatus(status: DevinStatusEnum | undefined): boolean {
  return status !== undefined && DEVIN_TERMINAL_STATUSES.has(status);
}

/**
 * A message is Devin's own if it is not attributed to a human. Devin's docs
 * do not spell out the exact `origin` values, so this stays permissive:
 * anything tied to a user_id/username is the human side of the conversation
 * (whose text Modesto already has, since it sent it) and everything else is
 * surfaced as the assistant's response.
 */
function isDevinOriginatedMessage(message: DevinMessage): boolean {
  return !message.user_id && !message.username;
}

export function resolveDevinApiBaseUrl(settings: Pick<DevinSettings, "apiBaseUrl">): string {
  const configured = settings.apiBaseUrl?.trim();
  return (configured || DEVIN_DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

export function readDevinApiKey(environment: NodeJS.ProcessEnv | undefined): string | undefined {
  const key = environment?.[DEVIN_API_KEY_ENV]?.trim();
  return key ? key : undefined;
}

// ── Local session/turn bookkeeping ─────────────────────────────────────

interface DevinSessionContext {
  readonly threadId: ThreadId;
  // Owns the turn-polling fiber's lifetime. A fiber forked as a child of the
  // short-lived `sendTurn` call would be interrupted the instant that call
  // returns; forking into this scope lets it run as long as the session does.
  readonly scope: Scope.Closeable;
  devinSessionId: string | null;
  session: ProviderSession;
  activeTurnFiber: Fiber.Fiber<void, never> | null;
  readonly seenEventIds: Set<string>;
  readonly completedTurns: Array<ProviderThreadTurnSnapshot>;
  stopped: boolean;
}

export function makeDevinAdapter(settings: DevinSettings, options?: DevinAdapterLiveOptions) {
  return Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto;
    const boundInstanceId = options?.instanceId ?? ProviderInstanceId.make(PROVIDER);
    const environment = options?.environment ?? process.env;
    const apiBaseUrl = resolveDevinApiBaseUrl(settings);
    const fetchImplementation = options?.fetchImplementation ?? fetch;
    const pollIntervalMs = options?.pollIntervalMs ?? DEVIN_POLL_INTERVAL_MS;
    const nativeEventLogger = options?.nativeEventLogger;

    const sessions = new Map<ThreadId, DevinSessionContext>();
    const runtimeEventQueue = yield* Queue.unbounded<ProviderRuntimeEvent>();

    const nowIso = Effect.map(DateTime.now, DateTime.formatIso);
    const randomUUIDv4 = crypto.randomUUIDv4.pipe(
      Effect.mapError(
        (cause) =>
          new ProviderAdapterRequestError({
            provider: PROVIDER,
            method: "crypto/randomUUIDv4",
            detail: "Failed to generate Devin runtime identifier.",
            cause,
          }),
      ),
      Effect.orDie,
    );

    const makeEventBase = (context: DevinSessionContext) =>
      Effect.gen(function* () {
        return {
          eventId: EventId.make(yield* randomUUIDv4),
          provider: PROVIDER,
          providerInstanceId: boundInstanceId,
          threadId: context.threadId,
          createdAt: yield* nowIso,
        };
      });

    const offerRuntimeEvent = (event: ProviderRuntimeEvent) =>
      Effect.gen(function* () {
        if (nativeEventLogger) {
          yield* nativeEventLogger.write(event, event.threadId).pipe(Effect.ignore);
        }
        yield* Queue.offer(runtimeEventQueue, event);
      }).pipe(Effect.asVoid);

    const devinRequest = <T>(input: {
      readonly method: "GET" | "POST" | "DELETE";
      readonly path: string;
      readonly apiKey: string;
      readonly body?: unknown;
    }): Effect.Effect<T, ProviderAdapterRequestError> =>
      Effect.tryPromise({
        try: async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), DEVIN_REQUEST_TIMEOUT_MS);
          try {
            const response = await fetchImplementation(`${apiBaseUrl}${input.path}`, {
              method: input.method,
              headers: {
                Authorization: `Bearer ${input.apiKey}`,
                ...(input.body !== undefined ? { "Content-Type": "application/json" } : {}),
              },
              ...(input.body !== undefined ? { body: JSON.stringify(input.body) } : {}),
              signal: controller.signal,
            });
            const text = await response.text();
            if (!response.ok) {
              throw new Error(
                `Devin API ${input.method} ${input.path} failed with HTTP ${response.status}` +
                  (text ? `: ${text.slice(0, 500)}` : ""),
              );
            }
            return (text.trim().length > 0 ? JSON.parse(text) : undefined) as T;
          } finally {
            clearTimeout(timeout);
          }
        },
        catch: (cause) =>
          new ProviderAdapterRequestError({
            provider: PROVIDER,
            method: `${input.method} ${input.path}`,
            detail: cause instanceof Error ? cause.message : String(cause),
            cause,
          }),
      });

    const requireApiKey = Effect.suspend(() => {
      const apiKey = readDevinApiKey(environment);
      return apiKey
        ? Effect.succeed(apiKey)
        : Effect.fail(
            new ProviderAdapterRequestError({
              provider: PROVIDER,
              method: "auth",
              detail: `${DEVIN_API_KEY_ENV} is not set. Add it to this Devin instance's environment in Settings before starting a session.`,
            }),
          );
    });

    const requireSession = Effect.fn("requireSession")(function* (threadId: ThreadId) {
      const context = sessions.get(threadId);
      if (!context) {
        return yield* new ProviderAdapterSessionNotFoundError({ provider: PROVIDER, threadId });
      }
      if (context.stopped) {
        return yield* new ProviderAdapterSessionClosedError({ provider: PROVIDER, threadId });
      }
      return context;
    });

    /**
     * One turn's whole life: dispatch (create-or-message), then poll until
     * Devin settles. Runs as an interruptible fiber forked into the session's
     * scope.
     */
    const runDevinTurn = Effect.fn("runDevinTurn")(function* (
      context: DevinSessionContext,
      turnId: TurnId,
      prompt: string,
    ) {
      const apiKey = yield* requireApiKey;
      const turnMessages: Array<DevinMessage> = [];

      yield* offerRuntimeEvent({
        ...(yield* makeEventBase(context)),
        turnId,
        type: "turn.started",
        payload: {},
      });

      const sessionIdResult = yield* Effect.result(
        context.devinSessionId
          ? devinRequest<void>({
              method: "POST",
              path: `/sessions/${context.devinSessionId}/message`,
              apiKey,
              body: { message: prompt },
            }).pipe(Effect.as(context.devinSessionId))
          : devinRequest<DevinCreateSessionResponse>({
              method: "POST",
              path: "/sessions",
              apiKey,
              body: { prompt },
            }).pipe(
              Effect.map((created) => {
                context.devinSessionId = created.session_id;
                return created.session_id;
              }),
            ),
      );

      if (Result.isFailure(sessionIdResult)) {
        const detail = sessionIdResult.failure.detail;
        yield* offerRuntimeEvent({
          ...(yield* makeEventBase(context)),
          turnId,
          type: "runtime.error",
          payload: { message: detail, class: "provider_error" as const },
        });
        yield* offerRuntimeEvent({
          ...(yield* makeEventBase(context)),
          turnId,
          type: "turn.completed",
          payload: { state: "failed" as const, errorMessage: detail },
        });
        context.session = { ...context.session, status: "error", lastError: detail };
        return;
      }
      const sessionId = sessionIdResult.success;
      context.session = { ...context.session, status: "running", activeTurnId: turnId };

      let terminal = false;
      while (!terminal) {
        yield* Effect.sleep(`${pollIntervalMs} millis`);

        const pollResult = yield* Effect.result(
          devinRequest<DevinSessionDetails>({
            method: "GET",
            path: `/sessions/${sessionId}`,
            apiKey,
          }),
        );

        if (Result.isFailure(pollResult)) {
          yield* offerRuntimeEvent({
            ...(yield* makeEventBase(context)),
            turnId,
            type: "runtime.error",
            payload: { message: pollResult.failure.detail, class: "transport_error" as const },
          });
          continue;
        }
        const details = pollResult.success;

        for (const message of details.messages ?? []) {
          if (context.seenEventIds.has(message.event_id)) {
            continue;
          }
          context.seenEventIds.add(message.event_id);
          turnMessages.push(message);
          if (!isDevinOriginatedMessage(message) || message.message.trim().length === 0) {
            continue;
          }

          const itemId = RuntimeItemId.make(`devin-${message.event_id}`);
          yield* offerRuntimeEvent({
            ...(yield* makeEventBase(context)),
            turnId,
            itemId,
            type: "item.started",
            payload: {
              itemType: "assistant_message",
              status: "inProgress",
              title: "Assistant message",
            },
          });
          yield* offerRuntimeEvent({
            ...(yield* makeEventBase(context)),
            turnId,
            itemId,
            type: "content.delta",
            payload: { streamKind: "assistant_text", delta: message.message },
          });
          yield* offerRuntimeEvent({
            ...(yield* makeEventBase(context)),
            turnId,
            itemId,
            type: "item.completed",
            payload: {
              itemType: "assistant_message",
              status: "completed",
              title: "Assistant message",
            },
          });
        }

        // "blocked" means Devin is waiting on a human: the turn is over from
        // Modesto's point of view even though the remote session lives on.
        terminal = isDevinTerminalStatus(details.status_enum) || details.status_enum === "blocked";
      }

      context.completedTurns.push({ id: turnId, items: turnMessages });
      context.session = {
        ...context.session,
        status: "ready",
        activeTurnId: undefined,
        updatedAt: yield* nowIso,
      };
      yield* offerRuntimeEvent({
        ...(yield* makeEventBase(context)),
        turnId,
        type: "turn.completed",
        payload: { state: "completed" as const },
      });
    });

    const startSession: DevinAdapterShape["startSession"] = Effect.fn("startSession")(
      function* (input) {
        if (input.provider !== undefined && input.provider !== PROVIDER) {
          return yield* new ProviderAdapterValidationError({
            provider: PROVIDER,
            operation: "startSession",
            issue: `Expected provider '${PROVIDER}' but received '${input.provider}'.`,
          });
        }

        const now = yield* nowIso;
        const session: ProviderSession = {
          provider: PROVIDER,
          providerInstanceId: boundInstanceId,
          status: "ready",
          runtimeMode: input.runtimeMode,
          threadId: input.threadId,
          ...(input.cwd ? { cwd: input.cwd } : {}),
          createdAt: now,
          updatedAt: now,
        };
        const scope = yield* Scope.make("sequential");
        const context: DevinSessionContext = {
          threadId: input.threadId,
          scope,
          devinSessionId: null,
          session,
          activeTurnFiber: null,
          seenEventIds: new Set(),
          completedTurns: [],
          stopped: false,
        };
        sessions.set(input.threadId, context);

        yield* offerRuntimeEvent({
          ...(yield* makeEventBase(context)),
          type: "session.started",
          payload: {},
        });
        yield* offerRuntimeEvent({
          ...(yield* makeEventBase(context)),
          type: "session.configured",
          payload: { config: {} },
        });

        return context.session;
      },
    );

    const sendTurn: DevinAdapterShape["sendTurn"] = Effect.fn("sendTurn")(function* (input) {
      const context = yield* requireSession(input.threadId);
      if (context.activeTurnFiber) {
        return yield* new ProviderAdapterValidationError({
          provider: PROVIDER,
          operation: "sendTurn",
          issue: "A Devin turn is already in progress for this thread.",
        });
      }

      const promptText = input.input?.trim() ?? "";
      if (!promptText) {
        return yield* new ProviderAdapterValidationError({
          provider: PROVIDER,
          operation: "sendTurn",
          issue: "Input text is required - Devin's message API does not accept attachments.",
        });
      }
      const attachmentNote =
        input.attachments && input.attachments.length > 0
          ? `\n\n(${input.attachments.length} attachment(s) were included but could not be sent - Devin's message API is text-only.)`
          : "";

      const turnId = TurnId.make(yield* randomUUIDv4);
      const eventBase = yield* makeEventBase(context);
      const fiber = yield* runDevinTurn(context, turnId, `${promptText}${attachmentNote}`).pipe(
        // Surfaces a failure raised before the turn's own polling loop takes
        // over (today only a missing API key) the same way an in-flight HTTP
        // failure is surfaced, rather than letting it escape as an unhandled
        // fiber failure.
        Effect.catch((error) =>
          offerRuntimeEvent({
            ...eventBase,
            turnId,
            type: "runtime.error",
            payload: { message: error.detail, class: "provider_error" as const },
          }).pipe(
            Effect.andThen(
              offerRuntimeEvent({
                ...eventBase,
                turnId,
                type: "turn.completed",
                payload: { state: "failed" as const, errorMessage: error.detail },
              }),
            ),
          ),
        ),
        // This turn's fiber is the only writer of `activeTurnFiber` while it
        // runs (sendTurn rejects a second call until it clears), so clearing
        // it here on settle is safe.
        Effect.ensuring(
          Effect.sync(() => {
            context.activeTurnFiber = null;
          }),
        ),
        Effect.forkIn(context.scope),
      );
      context.activeTurnFiber = fiber;

      return { threadId: input.threadId, turnId } satisfies ProviderTurnStartResult;
    });

    const interruptTurn: DevinAdapterShape["interruptTurn"] = (threadId) =>
      Effect.gen(function* () {
        const context = sessions.get(threadId);
        if (!context?.activeTurnFiber) {
          return;
        }
        yield* Fiber.interrupt(context.activeTurnFiber);
        context.activeTurnFiber = null;
        yield* offerRuntimeEvent({
          ...(yield* makeEventBase(context)),
          type: "turn.aborted",
          payload: { reason: "Interrupted by user." },
        });
      });

    // Devin's REST API has no confirmed structured approval/user-input
    // endpoint. Best effort: forward the decision/answers as a plain follow-up
    // message when a remote session already exists to receive it.
    const respondToRequest: DevinAdapterShape["respondToRequest"] = (
      threadId: ThreadId,
      _requestId: ApprovalRequestId,
      decision: ProviderApprovalDecision,
    ) =>
      Effect.gen(function* () {
        const context = yield* requireSession(threadId);
        if (!context.devinSessionId) {
          return yield* new ProviderAdapterRequestError({
            provider: PROVIDER,
            method: "respondToRequest",
            detail:
              "Devin has no confirmed structured-approval endpoint, and no active session exists to receive a fallback message.",
          });
        }
        const apiKey = yield* requireApiKey;
        yield* devinRequest<void>({
          method: "POST",
          path: `/sessions/${context.devinSessionId}/message`,
          apiKey,
          body: { message: `Decision: ${decision}` },
        });
      });

    const respondToUserInput: DevinAdapterShape["respondToUserInput"] = (
      threadId: ThreadId,
      _requestId: ApprovalRequestId,
      answers: ProviderUserInputAnswers,
    ) =>
      Effect.gen(function* () {
        const context = yield* requireSession(threadId);
        if (!context.devinSessionId) {
          return yield* new ProviderAdapterRequestError({
            provider: PROVIDER,
            method: "respondToUserInput",
            detail:
              "Devin has no confirmed structured-user-input endpoint, and no active session exists to receive a fallback message.",
          });
        }
        const apiKey = yield* requireApiKey;
        yield* devinRequest<void>({
          method: "POST",
          path: `/sessions/${context.devinSessionId}/message`,
          apiKey,
          body: { message: JSON.stringify(answers) },
        });
      });

    const stopSession: DevinAdapterShape["stopSession"] = (threadId) =>
      Effect.gen(function* () {
        const context = sessions.get(threadId);
        if (!context) {
          return;
        }
        // Closing the scope interrupts any in-flight turn fiber forked into it.
        yield* Effect.ignore(Scope.close(context.scope, Exit.void));
        context.stopped = true;
        sessions.delete(threadId);
        if (!context.devinSessionId) {
          return;
        }
        const apiKey = yield* Effect.result(requireApiKey);
        if (Result.isFailure(apiKey)) {
          return;
        }
        yield* devinRequest<void>({
          method: "DELETE",
          path: `/sessions/${context.devinSessionId}`,
          apiKey: apiKey.success,
        }).pipe(Effect.ignore);
      });

    const stopAll: DevinAdapterShape["stopAll"] = () =>
      Effect.forEach(Array.from(sessions.keys()), (threadId) => stopSession(threadId), {
        concurrency: "unbounded",
        discard: true,
      });

    const listSessions: DevinAdapterShape["listSessions"] = () =>
      Effect.succeed(Array.from(sessions.values()).map((context) => context.session));

    const hasSession: DevinAdapterShape["hasSession"] = (threadId) =>
      Effect.succeed(sessions.has(threadId));

    const readThread: DevinAdapterShape["readThread"] = (threadId) =>
      Effect.gen(function* () {
        const context = yield* requireSession(threadId);
        return {
          threadId,
          turns: context.completedTurns,
        } satisfies ProviderThreadSnapshot;
      });

    const rollbackThread: DevinAdapterShape["rollbackThread"] = (threadId) =>
      Effect.gen(function* () {
        yield* requireSession(threadId);
        return yield* new ProviderAdapterRequestError({
          provider: PROVIDER,
          method: "rollbackThread",
          detail: "Devin's REST API has no confirmed conversation-rollback endpoint.",
        });
      });

    const adapter: DevinAdapterShape = {
      provider: PROVIDER,
      capabilities: {
        sessionModelSwitch: "unsupported",
      },
      startSession,
      sendTurn,
      interruptTurn,
      respondToRequest,
      respondToUserInput,
      stopSession,
      listSessions,
      hasSession,
      readThread,
      rollbackThread,
      stopAll,
      streamEvents: Stream.fromQueue(runtimeEventQueue),
    };
    return adapter;
  });
}
