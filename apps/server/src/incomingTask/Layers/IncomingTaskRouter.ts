import { randomUUID } from "node:crypto";

import {
  CommandId,
  EventId,
  IncomingTaskId,
  MessageId,
  ThreadId,
  type IncomingTask,
  type ModelSelection,
  type OrchestrationProjectShell,
} from "@modesto/contracts";
import { filterCloudAgentModelSelections } from "@modesto/shared/cloudAgents";
import { Effect, Layer, Option } from "effect";

import { GitCore } from "../../git/Services/GitCore.ts";
import { OrchestrationEngineService } from "../../orchestration/Services/OrchestrationEngine.ts";
import { ProjectionSnapshotQuery } from "../../orchestration/Services/ProjectionSnapshotQuery.ts";
import { IntegrationRepository } from "../../persistence/Services/IntegrationRepository.ts";
import { ServerSettingsService } from "../../serverSettings.ts";
import { IncomingTaskError } from "../Errors.ts";
import {
  IncomingTaskRouter,
  type IncomingTaskRouterShape,
} from "../Services/IncomingTaskRouter.ts";

const toTaskError =
  (message: string, code: IncomingTaskError["code"] = "dispatch-failed") =>
  (cause: unknown) =>
    new IncomingTaskError({ message, code, cause });

function taskIds(id: IncomingTaskId) {
  return {
    threadId: ThreadId.makeUnsafe(`incoming:${id}:thread`),
    messageId: MessageId.makeUnsafe(`incoming:${id}:message`),
    createCommandId: CommandId.makeUnsafe(`incoming:${id}:thread-create`),
    activityCommandId: CommandId.makeUnsafe(`incoming:${id}:activity`),
    turnCommandId: CommandId.makeUnsafe(`incoming:${id}:turn-start`),
    activityId: EventId.makeUnsafe(`incoming:${id}:received`),
  };
}

function selectModel(
  allowed: ReadonlyArray<ModelSelection>,
  requestedProvider: IncomingTask["requestedProvider"],
  defaultSelection: ModelSelection | null,
): ModelSelection | null {
  if (requestedProvider) {
    return allowed.find((selection) => selection.provider === requestedProvider) ?? null;
  }
  if (
    defaultSelection &&
    allowed.some(
      (selection) =>
        selection.provider === defaultSelection.provider &&
        selection.model === defaultSelection.model,
    )
  ) {
    return defaultSelection;
  }
  return allowed[0] ?? null;
}

type ThreadEnvironment = {
  readonly envMode: "local" | "worktree";
  readonly branch: string | null;
  readonly worktreePath: string | null;
  readonly associatedWorktreePath: string | null;
  readonly associatedWorktreeBranch: string | null;
  readonly associatedWorktreeRef: string | null;
};

const localEnvironment: ThreadEnvironment = {
  envMode: "local",
  branch: null,
  worktreePath: null,
  associatedWorktreePath: null,
  associatedWorktreeBranch: null,
  associatedWorktreeRef: null,
};

function incomingBranchName(task: IncomingTask): string {
  const slug = task.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = task.id
    .replace(/[^a-z0-9]+/gi, "-")
    .slice(-10)
    .toLowerCase();
  return `automation/openclaw/${slug || "task"}-${suffix}`;
}

export const makeIncomingTaskRouter = Effect.gen(function* () {
  const repository = yield* IntegrationRepository;
  const orchestration = yield* OrchestrationEngineService;
  const snapshots = yield* ProjectionSnapshotQuery;
  const git = yield* GitCore;
  const serverSettings = yield* ServerSettingsService;

  const resolveEnvironment = (
    task: IncomingTask,
    project: OrchestrationProjectShell,
  ): Effect.Effect<ThreadEnvironment, IncomingTaskError> => {
    if (task.permissionSnapshot.envMode === "local") return Effect.succeed(localEnvironment);
    return git.statusDetails(project.workspaceRoot).pipe(
      Effect.mapError(toTaskError("Failed to inspect the allowed workspace.")),
      Effect.flatMap((status) => {
        if (!status.isRepo || !status.branch) {
          return Effect.fail(
            new IncomingTaskError({
              code: "configuration-invalid",
              message: "A worktree task requires an initialized Git repository on a branch.",
            }),
          );
        }
        return git
          .createWorktree({
            cwd: project.workspaceRoot,
            branch: status.branch,
            newBranch: incomingBranchName(task),
            path: null,
          })
          .pipe(
            Effect.mapError(toTaskError("Failed to create the task worktree.")),
            Effect.map(
              (result): ThreadEnvironment => ({
                envMode: "worktree",
                branch: result.worktree.branch,
                worktreePath: result.worktree.path,
                associatedWorktreePath: result.worktree.path,
                associatedWorktreeBranch: result.worktree.branch,
                associatedWorktreeRef: result.worktree.branch,
              }),
            ),
          );
      }),
    );
  };

  const submit: IncomingTaskRouterShape["submit"] = (input) => {
    let persistedTask: IncomingTask | null = null;
    return Effect.gen(function* () {
      const duplicate = yield* repository
        .getTaskBySourceId({ source: input.source, sourceTaskId: input.sourceTaskId })
        .pipe(Effect.mapError(toTaskError("Failed to inspect incoming task history.")));
      if (Option.isSome(duplicate)) {
        return { task: duplicate.value, duplicate: true };
      }

      const configOption = yield* repository
        .getOpenClawConfig()
        .pipe(Effect.mapError(toTaskError("Failed to load OpenClaw permissions.")));
      if (Option.isNone(configOption) || !configOption.value.enabled) {
        return yield* new IncomingTaskError({
          code: "integration-disabled",
          message: "OpenClaw task intake is disabled.",
        });
      }
      const config = configOption.value;
      if (!config.allowedProjectIds.includes(input.projectId)) {
        return yield* new IncomingTaskError({
          code: "workspace-denied",
          message: "This workspace is not allowed for OpenClaw tasks.",
        });
      }

      const projectOption = yield* snapshots
        .getProjectShellById(input.projectId)
        .pipe(Effect.mapError(toTaskError("Failed to resolve the requested workspace.")));
      if (Option.isNone(projectOption)) {
        return yield* new IncomingTaskError({
          code: "workspace-denied",
          message: "The requested workspace is unavailable.",
        });
      }

      const settings = yield* serverSettings.getSettings.pipe(
        Effect.mapError(toTaskError("Failed to load provider settings.")),
      );
      const modelSelection = selectModel(
        filterCloudAgentModelSelections(config.allowedModelSelections, settings.providers),
        input.requestedProvider ?? null,
        config.defaultModelSelection,
      );
      if (!modelSelection) {
        return yield* new IncomingTaskError({
          code: "agent-denied",
          message:
            "No allowed coding agent matches this request. Enable a provider in Settings and allow it for OpenClaw.",
        });
      }

      const now = new Date().toISOString();
      const id = IncomingTaskId.makeUnsafe(`incoming-task:${randomUUID()}`);
      let task: IncomingTask = {
        id,
        source: input.source,
        sourceTaskId: input.sourceTaskId,
        title: input.title ?? "OpenClaw task",
        prompt: input.prompt,
        projectId: input.projectId,
        requestedProvider: input.requestedProvider ?? null,
        status: "accepted",
        threadId: null,
        permissionSnapshot: {
          projectId: input.projectId,
          modelSelection,
          runtimeMode: config.runtimeMode,
          interactionMode: config.interactionMode,
          envMode: config.envMode,
          createdAt: now,
        },
        error: null,
        createdAt: now,
        updatedAt: now,
      };
      const persisted = yield* repository.createTask(task).pipe(
        Effect.map((created) => ({ task: created, duplicate: false as const })),
        Effect.catch(() =>
          repository
            .getTaskBySourceId({
              source: input.source,
              sourceTaskId: input.sourceTaskId,
            })
            .pipe(
              Effect.flatMap(
                Option.match({
                  onNone: () =>
                    Effect.fail(
                      new IncomingTaskError({
                        code: "dispatch-failed",
                        message: "Failed to persist the incoming task.",
                      }),
                    ),
                  onSome: (existing) =>
                    Effect.succeed({ task: existing, duplicate: true as const }),
                }),
              ),
              Effect.mapError(toTaskError("Failed to persist the incoming task.")),
            ),
        ),
      );
      if (persisted.duplicate) return persisted;
      task = persisted.task;
      persistedTask = task;

      const ids = taskIds(task.id);
      const environment = yield* resolveEnvironment(task, projectOption.value);
      task = yield* repository
        .saveTask({
          ...task,
          status: "dispatching",
          threadId: ids.threadId,
          updatedAt: new Date().toISOString(),
        })
        .pipe(Effect.mapError(toTaskError("Failed to update the incoming task.")));
      persistedTask = task;

      yield* orchestration
        .dispatch({
          type: "thread.create",
          commandId: ids.createCommandId,
          threadId: ids.threadId,
          projectId: task.projectId,
          title: task.title,
          modelSelection,
          runtimeMode: config.runtimeMode,
          interactionMode: config.interactionMode,
          ...environment,
          createdAt: now,
        })
        .pipe(Effect.mapError(toTaskError("Failed to create the task thread.")));
      yield* orchestration
        .dispatch({
          type: "thread.activity.append",
          commandId: ids.activityCommandId,
          threadId: ids.threadId,
          activity: {
            id: ids.activityId,
            tone: "info",
            kind: "automation.openclaw.received",
            summary: "Received task from OpenClaw",
            payload: { incomingTaskId: task.id, sourceTaskId: task.sourceTaskId },
            turnId: null,
            createdAt: now,
          },
          createdAt: now,
        })
        .pipe(Effect.mapError(toTaskError("Failed to record OpenClaw activity.")));
      yield* orchestration
        .dispatch({
          type: "thread.turn.start",
          commandId: ids.turnCommandId,
          threadId: ids.threadId,
          message: {
            messageId: ids.messageId,
            role: "user",
            text: task.prompt,
            attachments: [],
          },
          modelSelection,
          dispatchMode: "queue",
          dispatchOrigin: "automation",
          runtimeMode: config.runtimeMode,
          interactionMode: config.interactionMode,
          createdAt: now,
        })
        .pipe(Effect.mapError(toTaskError("Failed to dispatch the OpenClaw task.")));

      task = yield* repository
        .saveTask({
          ...task,
          status: "running",
          updatedAt: new Date().toISOString(),
        })
        .pipe(Effect.mapError(toTaskError("Failed to update the incoming task.")));
      persistedTask = task;
      return { task, duplicate: false };
    }).pipe(
      Effect.catch((error) => {
        const normalized =
          error instanceof IncomingTaskError
            ? error
            : toTaskError("Failed to route incoming task.")(error);
        if (!persistedTask || persistedTask.status === "running") {
          return Effect.fail(normalized);
        }
        const failedTask: IncomingTask = {
          ...persistedTask,
          status: "failed",
          error: normalized.message,
          updatedAt: new Date().toISOString(),
        };
        return repository.saveTask(failedTask).pipe(
          Effect.catch(() => Effect.succeed(failedTask)),
          Effect.flatMap(() => Effect.fail(normalized)),
        );
      }),
    );
  };

  return { submit } satisfies IncomingTaskRouterShape;
});

export const IncomingTaskRouterLive = Layer.effect(IncomingTaskRouter, makeIncomingTaskRouter);
