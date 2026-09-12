// FILE: PiAdapter.ts
// Purpose: ProviderAdapter implementation for Pi, driven by its own RPC
//          protocol (`pi --mode rpc`) via the purpose-built PiRpcRuntime, NOT
//          the shared AcpSessionRuntime every other provider in this tree
//          uses - Pi does not speak ACP. See PiRpcSupport.ts's header for
//          the full architecture rationale and documented v1 simplifications
//          (no live model switch, no permission gating - the protocol has
//          none, no session resume).
//
//          Turn lifecycle is structurally different from every ACP adapter
//          here, because Pi's protocol is structurally different: the
//          `prompt`/`steer` RPC *command* resolves almost immediately (once
//          "accepted, queued, or handled" - not once the turn finishes), and
//          the actual completion signal is a separate, later `agent_end`
//          *event* on the stream. So `sendTurn` here sends the command,
//          waits for that quick ack, then separately awaits a per-session
//          "active turn" Deferred that the background event-processing loop
//          resolves when `agent_end` arrives - there is no promptsInFlight
//          race-settlement machinery to port from the ACP adapters, because
//          Pi's own process already serializes prompt/steer delivery and
//          reports exactly one `agent_end` per logical run.
// @module provider/Layers/PiAdapter

import {
  EventId,
  type PiSettings,
  type ProviderRuntimeEvent,
  type ProviderSession,
  type ProviderUserInputAnswers,
  ProviderDriverKind,
  ProviderInstanceId,
  RuntimeItemId,
  type ThreadId,
  TurnId,
} from "@modesto/contracts";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as PubSub from "effect/PubSub";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as SynchronizedRef from "effect/SynchronizedRef";

import { resolveAttachmentPath } from "../../attachmentStore.ts";
import { ServerConfig } from "../../config.ts";
import {
  ProviderAdapterRequestError,
  ProviderAdapterSessionNotFoundError,
  ProviderAdapterValidationError,
  type ProviderAdapterError,
} from "../Errors.ts";
import { buildPiRpcSpawnInput } from "../acp/PiRpcSupport.ts";
import * as PiRpcRuntime from "../acp/PiRpcRuntime.ts";
import { type PiAdapterShape } from "../Services/PiAdapter.ts";
import { type EventNdjsonLogger, makeEventNdjsonLogger } from "./EventNdjsonLogger.ts";

const PROVIDER = ProviderDriverKind.make("pi");
const PI_TURN_TIMEOUT_MS = 30 * 60_000;

function mapPiRpcError(
  method: string,
  threadId: ThreadId,
  error: PiRpcRuntime.PiRpcError,
): ProviderAdapterError {
  return new ProviderAdapterRequestError({
    provider: PROVIDER,
    method,
    detail: error.detail,
    cause: error,
  });
}

export interface PiAdapterLiveOptions {
  readonly environment?: NodeJS.ProcessEnv;
  readonly nativeEventLogPath?: string;
  readonly nativeEventLogger?: EventNdjsonLogger;
  readonly instanceId?: ProviderInstanceId;
}

interface ActiveTurn {
  readonly turnId: TurnId;
  readonly completion: Deferred.Deferred<"completed" | "cancelled" | "failed">;
  settled: boolean;
  errorMessage: string | undefined;
}

interface PiSessionContext {
  readonly threadId: ThreadId;
  session: ProviderSession;
  readonly scope: Scope.Closeable;
  readonly rpc: PiRpcRuntime.PiRpcRuntime["Service"];
  notificationFiber: Fiber.Fiber<void, never> | undefined;
  active: ActiveTurn | undefined;
  readonly interruptedTurnIds: Set<TurnId>;
  turns: Array<{ id: TurnId; items: Array<unknown> }>;
  readonly modelId: string | undefined;
  stopped: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function makePiAdapter(piSettings: PiSettings, options?: PiAdapterLiveOptions) {
  return Effect.gen(function* () {
    const boundInstanceId = options?.instanceId ?? ProviderInstanceId.make("pi");
    const path = yield* Path.Path;
    const fileSystem = yield* FileSystem.FileSystem;
    const serverConfig = yield* Effect.service(ServerConfig);
    const crypto = yield* Crypto.Crypto;
    const nativeEventLogger =
      options?.nativeEventLogger ??
      (options?.nativeEventLogPath !== undefined
        ? yield* makeEventNdjsonLogger(options.nativeEventLogPath, { stream: "native" })
        : undefined);
    const managedNativeEventLogger =
      options?.nativeEventLogger === undefined ? nativeEventLogger : undefined;

    const sessions = new Map<ThreadId, PiSessionContext>();
    const threadLocksRef = yield* SynchronizedRef.make(new Map<string, Semaphore.Semaphore>());
    const runtimeEventPubSub = yield* PubSub.unbounded<ProviderRuntimeEvent>();

    const nowIso = Effect.map(DateTime.now, DateTime.formatIso);
    const randomUUIDv4 = crypto.randomUUIDv4.pipe(
      Effect.mapError(
        (cause) =>
          new ProviderAdapterRequestError({
            provider: PROVIDER,
            method: "crypto/randomUUIDv4",
            detail: "Failed to generate Pi runtime identifier.",
            cause,
          }),
      ),
    );
    const nextEventId = Effect.map(randomUUIDv4, (id) => EventId.make(id));
    const makeEventStamp = () => Effect.all({ eventId: nextEventId, createdAt: nowIso });

    const offerRuntimeEvent = (event: ProviderRuntimeEvent) =>
      PubSub.publish(runtimeEventPubSub, event).pipe(Effect.asVoid);

    const getThreadSemaphore = (threadId: string) =>
      SynchronizedRef.modifyEffect(threadLocksRef, (current) => {
        const existing: Option.Option<Semaphore.Semaphore> = Option.fromNullishOr(
          current.get(threadId),
        );
        return Option.match(existing, {
          onNone: () =>
            Semaphore.make(1).pipe(
              Effect.map((semaphore) => {
                const next = new Map(current);
                next.set(threadId, semaphore);
                return [semaphore, next] as const;
              }),
            ),
          onSome: (semaphore) => Effect.succeed([semaphore, current] as const),
        });
      });

    const withThreadLock = <A, E, R>(threadId: string, effect: Effect.Effect<A, E, R>) =>
      Effect.flatMap(getThreadSemaphore(threadId), (semaphore) => semaphore.withPermit(effect));

    const logNative = (threadId: ThreadId, method: string, payload: unknown) =>
      Effect.gen(function* () {
        if (!nativeEventLogger) return;
        const observedAt = yield* nowIso;
        yield* nativeEventLogger.write(
          {
            observedAt,
            event: {
              id: yield* randomUUIDv4,
              kind: "notification",
              provider: PROVIDER,
              createdAt: observedAt,
              method,
              threadId,
              payload,
            },
          },
          threadId,
        );
      }).pipe(
        Effect.catchCause((cause) =>
          Effect.logWarning("Failed to write native Pi notification log.", {
            cause,
            threadId,
            method,
          }),
        ),
      );

    const requireSession = (
      threadId: ThreadId,
    ): Effect.Effect<PiSessionContext, ProviderAdapterSessionNotFoundError> => {
      const ctx = sessions.get(threadId);
      if (!ctx || ctx.stopped) {
        return Effect.fail(
          new ProviderAdapterSessionNotFoundError({ provider: PROVIDER, threadId }),
        );
      }
      return Effect.succeed(ctx);
    };

    const settleActiveTurn = (
      ctx: PiSessionContext,
      outcome: "completed" | "cancelled" | "failed",
    ) =>
      Effect.gen(function* () {
        const active = ctx.active;
        if (!active || active.settled) return;
        active.settled = true;
        yield* Deferred.succeed(active.completion, outcome).pipe(Effect.ignore);
        const updatedAt = yield* nowIso;
        ctx.session = { ...ctx.session, status: "ready", activeTurnId: undefined, updatedAt };
        yield* offerRuntimeEvent({
          type: "turn.completed",
          ...(yield* makeEventStamp()),
          provider: PROVIDER,
          threadId: ctx.threadId,
          turnId: active.turnId,
          payload: {
            state:
              outcome === "cancelled" ? "cancelled" : outcome === "failed" ? "failed" : "completed",
            ...(active.errorMessage ? { errorMessage: active.errorMessage } : {}),
          },
        });
        ctx.active = undefined;
      });

    const stopSessionInternal = (ctx: PiSessionContext) =>
      Effect.gen(function* () {
        if (ctx.stopped) return;
        ctx.stopped = true;
        yield* settleActiveTurn(ctx, "cancelled");
        if (ctx.notificationFiber) {
          yield* Fiber.interrupt(ctx.notificationFiber);
        }
        yield* Effect.ignore(Scope.close(ctx.scope, Exit.void));
        sessions.delete(ctx.threadId);
        yield* offerRuntimeEvent({
          type: "session.exited",
          ...(yield* makeEventStamp()),
          provider: PROVIDER,
          threadId: ctx.threadId,
          payload: { exitKind: "graceful" },
        });
      });

    const startSession: PiAdapterShape["startSession"] = (input) =>
      withThreadLock(
        input.threadId,
        Effect.gen(function* () {
          if (input.provider !== undefined && input.provider !== PROVIDER) {
            return yield* new ProviderAdapterValidationError({
              provider: PROVIDER,
              operation: "startSession",
              issue: `Expected provider '${PROVIDER}' but received '${input.provider}'.`,
            });
          }
          if (!input.cwd?.trim()) {
            return yield* new ProviderAdapterValidationError({
              provider: PROVIDER,
              operation: "startSession",
              issue: "cwd is required and must be non-empty.",
            });
          }

          const cwd = path.resolve(input.cwd.trim());
          const piModelSelection =
            input.modelSelection?.instanceId === boundInstanceId ? input.modelSelection : undefined;
          const existing = sessions.get(input.threadId);
          if (existing && !existing.stopped) {
            yield* stopSessionInternal(existing);
          }

          const sessionScope = yield* Scope.make("sequential");
          let sessionScopeTransferred = false;
          yield* Effect.addFinalizer(() =>
            sessionScopeTransferred ? Effect.void : Scope.close(sessionScope, Exit.void),
          );

          const spawnInput = buildPiRpcSpawnInput(
            piSettings,
            cwd,
            piModelSelection?.model,
            options?.environment,
          );
          const piContext = yield* Layer.build(PiRpcRuntime.layer({ spawn: spawnInput })).pipe(
            Effect.provideService(Scope.Scope, sessionScope),
            Effect.mapError((cause) => mapPiRpcError("process/spawn", input.threadId, cause)),
          );
          const rpc = yield* Effect.service(PiRpcRuntime.PiRpcRuntime).pipe(
            Effect.provide(piContext),
          );

          const sessionId = yield* randomUUIDv4;
          const now = yield* nowIso;
          const session: ProviderSession = {
            provider: PROVIDER,
            providerInstanceId: boundInstanceId,
            status: "ready",
            runtimeMode: input.runtimeMode,
            cwd,
            ...(piModelSelection?.model ? { model: piModelSelection.model } : {}),
            threadId: input.threadId,
            createdAt: now,
            updatedAt: now,
          };

          const ctx: PiSessionContext = {
            threadId: input.threadId,
            session,
            scope: sessionScope,
            rpc,
            notificationFiber: undefined,
            active: undefined,
            interruptedTurnIds: new Set(),
            turns: [],
            modelId: piModelSelection?.model,
            stopped: false,
          };

          const nf = yield* Stream.runDrain(
            Stream.mapEffect(rpc.getEvents(), (record) =>
              Effect.gen(function* () {
                yield* logNative(ctx.threadId, String(record.type), record);
                const active = ctx.active;

                switch (record.type) {
                  case "message_update": {
                    const assistantMessageEvent = isRecord(record.assistantMessageEvent)
                      ? record.assistantMessageEvent
                      : undefined;
                    const kind = assistantMessageEvent?.type;
                    if (kind !== "text_delta" && kind !== "thinking_delta") return;
                    const delta = assistantMessageEvent?.delta;
                    if (typeof delta !== "string" || !delta) return;
                    yield* offerRuntimeEvent({
                      type: "content.delta",
                      ...(yield* makeEventStamp()),
                      provider: PROVIDER,
                      threadId: ctx.threadId,
                      turnId: active?.turnId,
                      payload: {
                        streamKind: kind === "thinking_delta" ? "reasoning_text" : "assistant_text",
                        delta,
                      },
                      raw: { source: "pi.sdk.event", method: "message_update", payload: record },
                    });
                    return;
                  }
                  case "tool_execution_start": {
                    const toolCallId = record.toolCallId;
                    if (typeof toolCallId !== "string") return;
                    yield* offerRuntimeEvent({
                      type: "item.started",
                      ...(yield* makeEventStamp()),
                      provider: PROVIDER,
                      threadId: ctx.threadId,
                      turnId: active?.turnId,
                      itemId: RuntimeItemId.make(toolCallId),
                      payload: {
                        itemType: "dynamic_tool_call",
                        status: "inProgress",
                        ...(typeof record.toolName === "string" ? { title: record.toolName } : {}),
                      },
                      raw: {
                        source: "pi.sdk.event",
                        method: "tool_execution_start",
                        payload: record,
                      },
                    });
                    return;
                  }
                  case "tool_execution_end": {
                    const toolCallId = record.toolCallId;
                    if (typeof toolCallId !== "string") return;
                    const isError = record.isError === true;
                    yield* offerRuntimeEvent({
                      type: "item.completed",
                      ...(yield* makeEventStamp()),
                      provider: PROVIDER,
                      threadId: ctx.threadId,
                      turnId: active?.turnId,
                      itemId: RuntimeItemId.make(toolCallId),
                      payload: {
                        itemType: "dynamic_tool_call",
                        status: isError ? "failed" : "completed",
                        ...(typeof record.toolName === "string" ? { title: record.toolName } : {}),
                      },
                      raw: {
                        source: "pi.sdk.event",
                        method: "tool_execution_end",
                        payload: record,
                      },
                    });
                    return;
                  }
                  case "agent_end": {
                    const outcome =
                      active && ctx.interruptedTurnIds.has(active.turnId)
                        ? ("cancelled" as const)
                        : ("completed" as const);
                    yield* settleActiveTurn(ctx, outcome);
                    return;
                  }
                  case "extension_error": {
                    yield* Effect.logWarning("Pi extension error.", { record });
                    return;
                  }
                  default:
                    return;
                }
              }),
            ),
          ).pipe(
            Effect.catch((cause) =>
              Effect.logError("Failed to process Pi runtime notification.", { cause }),
            ),
            Effect.forkIn(ctx.scope),
          );

          ctx.notificationFiber = nf;
          sessions.set(input.threadId, ctx);
          sessionScopeTransferred = true;

          yield* offerRuntimeEvent({
            type: "session.started",
            ...(yield* makeEventStamp()),
            provider: PROVIDER,
            threadId: input.threadId,
            payload: {},
          });
          yield* offerRuntimeEvent({
            type: "session.state.changed",
            ...(yield* makeEventStamp()),
            provider: PROVIDER,
            threadId: input.threadId,
            payload: { state: "ready", reason: "Pi RPC session ready" },
          });
          yield* offerRuntimeEvent({
            type: "thread.started",
            ...(yield* makeEventStamp()),
            provider: PROVIDER,
            threadId: input.threadId,
            payload: { providerThreadId: sessionId },
          });

          return session;
        }).pipe(Effect.scoped),
      );

    const sendTurn: PiAdapterShape["sendTurn"] = (input) =>
      Effect.gen(function* () {
        const prepared = yield* withThreadLock(
          input.threadId,
          Effect.gen(function* () {
            const ctx = yield* requireSession(input.threadId);
            const text = input.input?.trim();
            if (!text && (!input.attachments || input.attachments.length === 0)) {
              return yield* new ProviderAdapterValidationError({
                provider: PROVIDER,
                operation: "sendTurn",
                issue: "Turn requires non-empty text or attachments.",
              });
            }
            const images = yield* Effect.forEach(
              (input.attachments ?? []).filter((attachment) =>
                attachment.mimeType?.startsWith("image/"),
              ),
              (attachment) =>
                Effect.gen(function* () {
                  const attachmentPath = resolveAttachmentPath({
                    attachmentsDir: serverConfig.attachmentsDir,
                    attachment,
                  });
                  if (!attachmentPath) {
                    return yield* new ProviderAdapterRequestError({
                      provider: PROVIDER,
                      method: "prompt",
                      detail: `Invalid attachment id '${attachment.id}'.`,
                    });
                  }
                  const bytes = yield* fileSystem.readFile(attachmentPath).pipe(
                    Effect.mapError(
                      (cause) =>
                        new ProviderAdapterRequestError({
                          provider: PROVIDER,
                          method: "prompt",
                          detail: cause.message,
                          cause,
                        }),
                    ),
                  );
                  return {
                    type: "image" as const,
                    data: Buffer.from(bytes).toString("base64"),
                    mimeType: attachment.mimeType,
                  };
                }),
            );

            const isSteer = ctx.active !== undefined;
            const activeTurn: ActiveTurn = isSteer
              ? ctx.active!
              : {
                  turnId: TurnId.make(yield* randomUUIDv4),
                  completion: yield* Deferred.make<"completed" | "cancelled" | "failed">(),
                  settled: false,
                  errorMessage: undefined,
                };

            if (!isSteer) {
              ctx.active = activeTurn;
              const updatedAt = yield* nowIso;
              ctx.session = {
                ...ctx.session,
                status: "running",
                activeTurnId: activeTurn.turnId,
                updatedAt,
              };
              yield* offerRuntimeEvent({
                type: "turn.started",
                ...(yield* makeEventStamp()),
                provider: PROVIDER,
                threadId: input.threadId,
                turnId: activeTurn.turnId,
                payload: ctx.modelId ? { model: ctx.modelId } : {},
              });
            }

            const command = isSteer
              ? { type: "steer", message: text ?? "", ...(images.length ? { images } : {}) }
              : { type: "prompt", message: text ?? "", ...(images.length ? { images } : {}) };

            const response = yield* ctx.rpc
              .sendCommand(command)
              .pipe(Effect.mapError((cause) => mapPiRpcError("prompt", input.threadId, cause)));

            if (response.success !== true) {
              const detail =
                typeof response.error === "string" ? response.error : "Pi rejected the prompt.";
              if (!isSteer) {
                activeTurn.errorMessage = detail;
                yield* settleActiveTurn(ctx, "failed");
              }
              return yield* new ProviderAdapterRequestError({
                provider: PROVIDER,
                method: "prompt",
                detail,
              });
            }

            return { ctx, turnId: activeTurn.turnId, completion: activeTurn.completion };
          }),
        );

        const settled = yield* Deferred.await(prepared.completion).pipe(
          Effect.timeoutOption(PI_TURN_TIMEOUT_MS),
        );
        if (Option.isNone(settled)) {
          yield* withThreadLock(
            input.threadId,
            Effect.gen(function* () {
              const ctx = sessions.get(input.threadId);
              if (!ctx) return;
              if (ctx.active?.turnId === prepared.turnId) {
                ctx.active.errorMessage = "Pi turn timed out.";
              }
              yield* settleActiveTurn(ctx, "failed");
            }),
          );
        }

        const liveCtx = sessions.get(input.threadId);
        return {
          threadId: input.threadId,
          turnId: prepared.turnId,
          resumeCursor: liveCtx?.session.resumeCursor,
        };
      });

    const interruptTurn: PiAdapterShape["interruptTurn"] = (threadId, turnId) =>
      withThreadLock(
        threadId,
        Effect.gen(function* () {
          const ctx = yield* requireSession(threadId);
          const active = ctx.active;
          if (!active) return;
          if (turnId !== undefined && active.turnId !== turnId) return;
          ctx.interruptedTurnIds.add(active.turnId);
          yield* Effect.ignore(
            ctx.rpc
              .sendCommand({ type: "abort" })
              .pipe(Effect.mapError((cause) => mapPiRpcError("abort", threadId, cause))),
          );
          yield* settleActiveTurn(ctx, "cancelled");
        }),
      );

    const respondToRequest: PiAdapterShape["respondToRequest"] = (threadId, requestId, _decision) =>
      Effect.gen(function* () {
        yield* requireSession(threadId);
        // Pi's RPC protocol has no permission-request command - nothing ever
        // populates a pending-approval map, so any call here is honestly
        // "unknown request" rather than a silent no-op. See the module
        // header and PiRpcSupport.ts's for why.
        return yield* new ProviderAdapterRequestError({
          provider: PROVIDER,
          method: "request/respond",
          detail: `Unknown pending approval request: ${requestId}`,
        });
      });

    const respondToUserInput: PiAdapterShape["respondToUserInput"] = (
      threadId,
      requestId,
      _answers: ProviderUserInputAnswers,
    ) =>
      Effect.gen(function* () {
        yield* requireSession(threadId);
        return yield* new ProviderAdapterRequestError({
          provider: PROVIDER,
          method: "session/user_input",
          detail: `Unknown pending user-input request: ${requestId}`,
        });
      });

    const readThread: PiAdapterShape["readThread"] = (threadId) =>
      Effect.gen(function* () {
        const ctx = yield* requireSession(threadId);
        return { threadId, turns: ctx.turns };
      });

    const rollbackThread: PiAdapterShape["rollbackThread"] = (threadId, numTurns) =>
      Effect.gen(function* () {
        yield* requireSession(threadId);
        if (!Number.isInteger(numTurns) || numTurns < 1) {
          return yield* new ProviderAdapterValidationError({
            provider: PROVIDER,
            operation: "rollbackThread",
            issue: "numTurns must be an integer >= 1.",
          });
        }
        return yield* new ProviderAdapterRequestError({
          provider: PROVIDER,
          method: "thread/rollback",
          detail: "Pi sessions do not support provider-side rollback yet.",
        });
      });

    const stopSession: PiAdapterShape["stopSession"] = (threadId) =>
      withThreadLock(
        threadId,
        Effect.gen(function* () {
          const ctx = yield* requireSession(threadId);
          yield* stopSessionInternal(ctx);
        }),
      );

    const listSessions: PiAdapterShape["listSessions"] = () =>
      Effect.sync(() => Array.from(sessions.values(), (c) => ({ ...c.session })));

    const hasSession: PiAdapterShape["hasSession"] = (threadId) =>
      Effect.sync(() => {
        const c = sessions.get(threadId);
        return c !== undefined && !c.stopped;
      });

    const stopAll: PiAdapterShape["stopAll"] = () =>
      Effect.forEach(Array.from(sessions.values()), stopSessionInternal, { discard: true });

    yield* Effect.addFinalizer(() =>
      Effect.ignore(stopAll()).pipe(
        Effect.tap(() => PubSub.shutdown(runtimeEventPubSub)),
        Effect.tap(() => managedNativeEventLogger?.close() ?? Effect.void),
      ),
    );

    const streamEvents = Stream.fromPubSub(runtimeEventPubSub);

    return {
      provider: PROVIDER,
      capabilities: { sessionModelSwitch: "unsupported" },
      startSession,
      sendTurn,
      interruptTurn,
      readThread,
      rollbackThread,
      respondToRequest,
      respondToUserInput,
      stopSession,
      listSessions,
      hasSession,
      stopAll,
      streamEvents,
    } satisfies PiAdapterShape;
  });
}
