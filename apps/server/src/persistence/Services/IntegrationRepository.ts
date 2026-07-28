import {
  IncomingTask,
  IncomingTaskId,
  IncomingTaskSource,
  OpenClawConnectionConfig,
  ThreadId,
} from "@modesto/contracts";
import { ServiceMap } from "effect";
import type { Effect, Option } from "effect";

import type { IntegrationRepositoryError } from "../Errors.ts";

export interface IntegrationRepositoryShape {
  readonly getOpenClawConfig: () => Effect.Effect<
    Option.Option<OpenClawConnectionConfig>,
    IntegrationRepositoryError
  >;
  readonly saveOpenClawConfig: (
    config: OpenClawConnectionConfig,
  ) => Effect.Effect<OpenClawConnectionConfig, IntegrationRepositoryError>;
  readonly createTask: (
    task: IncomingTask,
  ) => Effect.Effect<IncomingTask, IntegrationRepositoryError>;
  readonly saveTask: (
    task: IncomingTask,
  ) => Effect.Effect<IncomingTask, IntegrationRepositoryError>;
  readonly getTaskById: (
    id: IncomingTaskId,
  ) => Effect.Effect<Option.Option<IncomingTask>, IntegrationRepositoryError>;
  readonly getTaskBySourceId: (input: {
    readonly source: IncomingTaskSource;
    readonly sourceTaskId: string;
  }) => Effect.Effect<Option.Option<IncomingTask>, IntegrationRepositoryError>;
  readonly getTaskByThreadId: (
    threadId: ThreadId,
  ) => Effect.Effect<Option.Option<IncomingTask>, IntegrationRepositoryError>;
  readonly listTasks: (input?: {
    readonly source?: IncomingTaskSource;
    readonly limit?: number;
  }) => Effect.Effect<ReadonlyArray<IncomingTask>, IntegrationRepositoryError>;
}

export class IntegrationRepository extends ServiceMap.Service<
  IntegrationRepository,
  IntegrationRepositoryShape
>()("modesto/persistence/Services/IntegrationRepository") {}
