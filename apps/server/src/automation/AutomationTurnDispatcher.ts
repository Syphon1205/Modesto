// FILE: AutomationTurnDispatcher.ts
// Purpose: The production `AutomationDispatcher` - runs a claimed automation as
//          a real turn on a real thread, and reports how that turn ended.
// Layer: Server automation
//
// Where automations run
// ---------------------
// In a single managed folder (`<baseDir>/automations`) owned by one project
// Modesto creates on demand, not in a repository the user picked. Three
// reasons: the engine's schema has no project at all (upstream models an
// automation as instructions + schedule + model, nothing more); an automation
// fires while nobody is watching, so running it inside a working repo would
// mutate a checkout the user may be mid-edit in; and a scheduled digest or
// report rarely wants a repo in the first place. A per-automation project
// override is a later addition - it needs a Modesto-side column the engine's
// tables do not have.
//
// How completion is observed
// --------------------------
// By watching the orchestration event stream for this thread's
// `thread.session-set` events, subscribed BEFORE the turn is dispatched: a
// short turn can settle before a subscription opened afterwards would see
// anything, and a missed completion would leave the run "running" until its
// lease expired. The turn is finished when the session reports no active turn
// after having reported one; `lastError` decides success from failure.

import {
  CommandId,
  MessageId,
  ProjectId,
  ThreadId,
  type ModelSelection,
  type OrchestrationEvent,
  type ProviderInstanceId,
} from "@modesto/contracts";
import * as Clock from "effect/Clock";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import { ServerConfig } from "../config.ts";
import { OrchestrationEngineService } from "../orchestration/Services/OrchestrationEngine.ts";
import type { AutomationDispatchOutcome, AutomationDispatcher } from "./AutomationRunner.ts";

const AUTOMATIONS_PROJECT_TITLE = "Automations";

const UNKNOWN_USAGE = { inputTokens: null, outputTokens: null, costMicros: null } as const;

/**
 * Resolves the managed project automations run in, creating it the first time.
 *
 * The project id is remembered in a ref rather than looked up each time: the
 * lookup would need the projection, and the only thing that could invalidate
 * the id is the user deleting the project, which recreates on the next run
 * anyway.
 */
const makeAutomationsProject = Effect.fn("makeAutomationsProject")(function* () {
  const config = yield* ServerConfig;
  const crypto = yield* Crypto.Crypto;
  const engine = yield* OrchestrationEngineService;
  const projectIdRef = yield* Ref.make<ProjectId | null>(null);

  return Effect.fn("resolveAutomationsProject")(function* (modelSelection: ModelSelection) {
    const existing = yield* Ref.get(projectIdRef);
    if (existing !== null) return existing;

    const projectId = ProjectId.make(yield* crypto.randomUUIDv4);
    yield* engine.dispatch({
      type: "project.create",
      commandId: CommandId.make(yield* crypto.randomUUIDv4),
      projectId,
      title: AUTOMATIONS_PROJECT_TITLE,
      workspaceRoot: config.automationsDir,
      // The folder does not exist until the first automation runs.
      createWorkspaceRootIfMissing: true,
      defaultModelSelection: modelSelection,
      createdAt: DateTime.formatIso(yield* DateTime.now),
    });
    yield* Ref.set(projectIdRef, projectId);
    return projectId;
  });
});

/**
 * Turn an automation's stored model reference into a composer-style selection.
 *
 * The engine stores `providerId`/`modelId` as opaque strings; Modesto routes on
 * a provider *instance*. They coincide for every built-in default instance
 * (`defaultInstanceIdForDriver` uses the driver kind as the slug), which is
 * what an automation created in this tree will carry.
 */
function toModelSelection(model: {
  readonly providerId: string;
  readonly modelId: string;
  readonly variant?: string | null | undefined;
}): ModelSelection {
  return {
    instanceId: model.providerId as ProviderInstanceId,
    model: model.modelId,
    options: model.variant ? [{ id: "reasoningEffort", value: model.variant }] : [],
  };
}

export const makeAutomationTurnDispatcher = Effect.fn("makeAutomationTurnDispatcher")(
  function* (): Effect.fn.Return<
    AutomationDispatcher,
    never,
    ServerConfig | Crypto.Crypto | OrchestrationEngineService
  > {
    const crypto = yield* Crypto.Crypto;
    const engine = yield* OrchestrationEngineService;
    const resolveAutomationsProject = yield* makeAutomationsProject();

    const run: AutomationDispatcher["run"] = (input) =>
      Effect.gen(function* () {
        const modelSelection = toModelSelection(input.revision.model);
        const projectId = yield* resolveAutomationsProject(modelSelection);
        const threadId = ThreadId.make(yield* crypto.randomUUIDv4);
        const createdAt = DateTime.formatIso(yield* DateTime.now);

        // Subscribed before dispatch: a turn that settles quickly would
        // otherwise finish before anyone was listening.
        const settled = yield* Effect.forkScoped(
          awaitTurnSettled(engine.streamDomainEvents, threadId, input.revision.maximumRuntimeMs),
        );

        yield* engine.dispatch({
          type: "thread.turn.start",
          commandId: CommandId.make(yield* crypto.randomUUIDv4),
          threadId,
          message: {
            messageId: MessageId.make(yield* crypto.randomUUIDv4),
            role: "user",
            text: input.revision.instructions,
            attachments: [],
          },
          modelSelection,
          titleSeed: input.automation.name,
          runtimeMode: "auto",
          interactionMode: "default",
          bootstrap: {
            createThread: {
              projectId,
              title: input.automation.name,
              modelSelection,
              runtimeMode: "auto",
              interactionMode: "default",
              branch: null,
              worktreePath: null,
              createdAt,
            },
          },
          createdAt,
        });

        return yield* Fiber.join(settled);
      }).pipe(
        Effect.scoped,
        Effect.catchCause((cause) =>
          Effect.succeed({
            status: "failed",
            resultSummary: null,
            usage: UNKNOWN_USAGE,
            error: {
              code: "execution_failed" as const,
              message: `The automation's turn could not be started: ${cause}`,
              retryable: true,
            },
          } satisfies AutomationDispatchOutcome),
        ),
      );

    return { run };
  },
);

/**
 * Resolve when this thread's turn settles.
 *
 * "Settled" is a session update reporting no active turn *after* one was
 * reported - the thread is created with no turn yet, so the first such update
 * is startup, not completion. A run that outlives its revision's
 * `maximumRuntimeMs` is reported as timed out rather than waited on forever;
 * the turn itself keeps going, which is why the message says so.
 */
export function awaitTurnSettled(
  events: Stream.Stream<OrchestrationEvent>,
  threadId: ThreadId,
  maximumRuntimeMs: number,
): Effect.Effect<AutomationDispatchOutcome> {
  return Effect.gen(function* () {
    const startedAt = yield* Clock.currentTimeMillis;
    const sawActiveTurn = yield* Ref.make(false);

    const outcome = yield* events.pipe(
      Stream.filter(
        (event): event is Extract<OrchestrationEvent, { type: "thread.session-set" }> =>
          event.type === "thread.session-set" && event.payload.threadId === threadId,
      ),
      Stream.mapEffect((event) =>
        Effect.gen(function* () {
          const session = event.payload.session;
          if (session.activeTurnId !== null) {
            yield* Ref.set(sawActiveTurn, true);
            return Option.none<AutomationDispatchOutcome>();
          }
          if (!(yield* Ref.get(sawActiveTurn))) {
            return Option.none<AutomationDispatchOutcome>();
          }
          const finishedAt = yield* Clock.currentTimeMillis;
          return Option.some(
            session.lastError !== null
              ? ({
                  status: "failed",
                  resultSummary: null,
                  usage: UNKNOWN_USAGE,
                  error: {
                    code: "execution_failed" as const,
                    message: session.lastError,
                    retryable: true,
                  },
                } satisfies AutomationDispatchOutcome)
              : ({
                  status: "succeeded",
                  resultSummary: `Completed in ${Math.max(0, finishedAt - startedAt)}ms.`,
                  usage: UNKNOWN_USAGE,
                  error: null,
                } satisfies AutomationDispatchOutcome),
          );
        }),
      ),
      // `Stream.filterMap` takes a Result in this Effect version, so the
      // Option is narrowed the long way round instead.
      Stream.filter(Option.isSome),
      Stream.map((value) => value.value),
      Stream.runHead,
      Effect.timeoutOption(Duration.millis(maximumRuntimeMs)),
    );

    if (Option.isNone(outcome) || Option.isNone(outcome.value)) {
      return {
        status: "failed",
        resultSummary: null,
        usage: UNKNOWN_USAGE,
        error: {
          code: "execution_timed_out" as const,
          message: `The automation's turn did not finish within ${maximumRuntimeMs}ms. It may still be running on its thread.`,
          retryable: true,
        },
      } satisfies AutomationDispatchOutcome;
    }
    return outcome.value.value;
  });
}
