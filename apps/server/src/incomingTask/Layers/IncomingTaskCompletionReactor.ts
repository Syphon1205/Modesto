import { Effect, Layer, Option, Stream } from "effect";

import { OrchestrationEngineService } from "../../orchestration/Services/OrchestrationEngine.ts";
import { IntegrationRepository } from "../../persistence/Services/IntegrationRepository.ts";

export const IncomingTaskCompletionReactorLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const orchestration = yield* OrchestrationEngineService;
    const repository = yield* IntegrationRepository;

    yield* Effect.forkScoped(
      Stream.runForEach(orchestration.streamDomainEvents, (event) => {
        if (
          event.type !== "thread.activity-appended" ||
          event.payload.activity.kind !== "turn.completed"
        ) {
          return Effect.void;
        }
        const payload =
          event.payload.activity.payload && typeof event.payload.activity.payload === "object"
            ? (event.payload.activity.payload as Record<string, unknown>)
            : null;
        const failed = payload?.state === "failed" || event.payload.activity.tone === "error";
        return repository.getTaskByThreadId(event.payload.threadId).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.void,
              onSome: (task) => {
                if (task.status !== "running" && task.status !== "dispatching") {
                  return Effect.void;
                }
                const now = new Date().toISOString();
                return repository.saveTask({
                  ...task,
                  status: failed ? "failed" : "completed",
                  error:
                    failed && typeof payload?.errorMessage === "string"
                      ? payload.errorMessage
                      : task.error,
                  updatedAt: now,
                });
              },
            }),
          ),
          Effect.catchCause((cause) =>
            Effect.logWarning("incoming task completion reconciliation failed", {
              threadId: event.payload.threadId,
              cause: String(cause),
            }),
          ),
          Effect.asVoid,
        );
      }),
    );
  }),
);
