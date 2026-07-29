import {
  IncomingTask,
  IncomingTaskPermissionSnapshot,
  LangGraphConnectionConfig,
  OpenClawConnectionConfig,
  type IncomingTaskSource,
} from "@modesto/contracts";
import { Effect, Layer, Option, Schema } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { toPersistenceDecodeError, toPersistenceSqlError } from "../Errors.ts";
import {
  IntegrationRepository,
  type IntegrationRepositoryShape,
} from "../Services/IntegrationRepository.ts";

interface IncomingTaskRow {
  readonly id: string;
  readonly source: string;
  readonly sourceTaskId: string;
  readonly title: string;
  readonly prompt: string;
  readonly projectId: string;
  readonly requestedProvider: string | null;
  readonly status: string;
  readonly threadId: string | null;
  readonly permissionSnapshot: string;
  readonly error: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const decodeTask = Schema.decodeUnknownEffect(IncomingTask);
const decodeConfig = Schema.decodeUnknownEffect(OpenClawConnectionConfig);
const decodeLangGraphConfig = Schema.decodeUnknownEffect(LangGraphConnectionConfig);

const toTask = (row: IncomingTaskRow) =>
  Schema.decodeUnknownEffect(Schema.fromJsonString(IncomingTaskPermissionSnapshot))(
    row.permissionSnapshot,
  ).pipe(
    Effect.flatMap((permissionSnapshot) =>
      decodeTask({
        ...row,
        permissionSnapshot,
        requestedProvider: row.requestedProvider,
      }),
    ),
    Effect.mapError(toPersistenceDecodeError("IntegrationRepository.taskRowToDomain")),
  );

const clampLimit = (limit: number | undefined) =>
  Math.max(1, Math.min(500, Math.trunc(limit ?? 100)));

const makeIntegrationRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const getOpenClawConfig: IntegrationRepositoryShape["getOpenClawConfig"] = () =>
    sql<{ readonly config: string }>`
      SELECT config_json AS "config"
      FROM integration_settings
      WHERE integration_id = 'openclaw'
      LIMIT 1
    `.pipe(
      Effect.mapError(toPersistenceSqlError("IntegrationRepository.getOpenClawConfig")),
      Effect.flatMap((rows) => {
        const row = rows[0];
        if (!row) return Effect.succeed(Option.none());
        return Schema.decodeUnknownEffect(Schema.fromJsonString(OpenClawConnectionConfig))(
          row.config,
        ).pipe(
          Effect.flatMap(decodeConfig),
          Effect.map(Option.some),
          Effect.mapError(
            toPersistenceDecodeError("IntegrationRepository.getOpenClawConfig.decode"),
          ),
        );
      }),
    );

  const saveOpenClawConfig: IntegrationRepositoryShape["saveOpenClawConfig"] = (config) =>
    Schema.encodeEffect(Schema.fromJsonString(OpenClawConnectionConfig))(config).pipe(
      Effect.flatMap(
        (encoded) =>
          sql`
          INSERT INTO integration_settings (integration_id, config_json, updated_at)
          VALUES ('openclaw', ${encoded}, ${config.updatedAt})
          ON CONFLICT(integration_id) DO UPDATE SET
            config_json = excluded.config_json,
            updated_at = excluded.updated_at
        `,
      ),
      Effect.as(config),
      Effect.mapError(toPersistenceSqlError("IntegrationRepository.saveOpenClawConfig")),
    );

  const getLangGraphConfig: IntegrationRepositoryShape["getLangGraphConfig"] = () =>
    sql<{ readonly config: string }>`
      SELECT config_json AS "config"
      FROM integration_settings
      WHERE integration_id = 'langgraph'
      LIMIT 1
    `.pipe(
      Effect.mapError(toPersistenceSqlError("IntegrationRepository.getLangGraphConfig")),
      Effect.flatMap((rows) => {
        const row = rows[0];
        if (!row) return Effect.succeed(Option.none());
        return Schema.decodeUnknownEffect(Schema.fromJsonString(LangGraphConnectionConfig))(
          row.config,
        ).pipe(
          Effect.flatMap(decodeLangGraphConfig),
          Effect.map(Option.some),
          Effect.mapError(
            toPersistenceDecodeError("IntegrationRepository.getLangGraphConfig.decode"),
          ),
        );
      }),
    );

  const saveLangGraphConfig: IntegrationRepositoryShape["saveLangGraphConfig"] = (config) =>
    Schema.encodeEffect(Schema.fromJsonString(LangGraphConnectionConfig))(config).pipe(
      Effect.flatMap(
        (encoded) =>
          sql`
          INSERT INTO integration_settings (integration_id, config_json, updated_at)
          VALUES ('langgraph', ${encoded}, ${config.updatedAt})
          ON CONFLICT(integration_id) DO UPDATE SET
            config_json = excluded.config_json,
            updated_at = excluded.updated_at
        `,
      ),
      Effect.as(config),
      Effect.mapError(toPersistenceSqlError("IntegrationRepository.saveLangGraphConfig")),
    );

  const writeTask = (task: IncomingTask, createOnly: boolean) =>
    Schema.encodeEffect(Schema.fromJsonString(IncomingTaskPermissionSnapshot))(
      task.permissionSnapshot,
    ).pipe(
      Effect.flatMap((permissionSnapshot) =>
        createOnly
          ? sql`
              INSERT INTO incoming_tasks (
                task_id, source, source_task_id, title, prompt, project_id,
                requested_provider, status, thread_id, permission_snapshot_json,
                error, created_at, updated_at
              ) VALUES (
                ${task.id}, ${task.source}, ${task.sourceTaskId}, ${task.title},
                ${task.prompt}, ${task.projectId}, ${task.requestedProvider},
                ${task.status}, ${task.threadId}, ${permissionSnapshot},
                ${task.error}, ${task.createdAt}, ${task.updatedAt}
              )
            `
          : sql`
              UPDATE incoming_tasks SET
                status = ${task.status},
                thread_id = ${task.threadId},
                permission_snapshot_json = ${permissionSnapshot},
                error = ${task.error},
                updated_at = ${task.updatedAt}
              WHERE task_id = ${task.id}
            `,
      ),
      Effect.as(task),
      Effect.mapError(
        toPersistenceSqlError(
          createOnly ? "IntegrationRepository.createTask" : "IntegrationRepository.saveTask",
        ),
      ),
    );

  const createTask: IntegrationRepositoryShape["createTask"] = (task) => writeTask(task, true);
  const saveTask: IntegrationRepositoryShape["saveTask"] = (task) => writeTask(task, false);

  const getTaskById: IntegrationRepositoryShape["getTaskById"] = (id) =>
    sql<IncomingTaskRow>`
      SELECT
        task_id AS "id", source, source_task_id AS "sourceTaskId", title, prompt,
        project_id AS "projectId", requested_provider AS "requestedProvider",
        status, thread_id AS "threadId",
        permission_snapshot_json AS "permissionSnapshot", error,
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM incoming_tasks
      WHERE task_id = ${id}
      LIMIT 1
    `.pipe(
      Effect.mapError(toPersistenceSqlError("IntegrationRepository.getTaskById")),
      Effect.flatMap((rows) => {
        const row = rows[0];
        return row ? toTask(row).pipe(Effect.map(Option.some)) : Effect.succeed(Option.none());
      }),
    );

  const getTaskBySourceId: IntegrationRepositoryShape["getTaskBySourceId"] = (input) =>
    sql<IncomingTaskRow>`
      SELECT
        task_id AS "id", source, source_task_id AS "sourceTaskId", title, prompt,
        project_id AS "projectId", requested_provider AS "requestedProvider",
        status, thread_id AS "threadId",
        permission_snapshot_json AS "permissionSnapshot", error,
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM incoming_tasks
      WHERE source = ${input.source} AND source_task_id = ${input.sourceTaskId}
      LIMIT 1
    `.pipe(
      Effect.mapError(toPersistenceSqlError("IntegrationRepository.getTaskBySourceId")),
      Effect.flatMap((rows) => {
        const row = rows[0];
        return row ? toTask(row).pipe(Effect.map(Option.some)) : Effect.succeed(Option.none());
      }),
    );

  const getTaskByThreadId: IntegrationRepositoryShape["getTaskByThreadId"] = (threadId) =>
    sql<IncomingTaskRow>`
      SELECT
        task_id AS "id", source, source_task_id AS "sourceTaskId", title, prompt,
        project_id AS "projectId", requested_provider AS "requestedProvider",
        status, thread_id AS "threadId",
        permission_snapshot_json AS "permissionSnapshot", error,
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM incoming_tasks
      WHERE thread_id = ${threadId}
      ORDER BY created_at DESC
      LIMIT 1
    `.pipe(
      Effect.mapError(toPersistenceSqlError("IntegrationRepository.getTaskByThreadId")),
      Effect.flatMap((rows) => {
        const row = rows[0];
        return row ? toTask(row).pipe(Effect.map(Option.some)) : Effect.succeed(Option.none());
      }),
    );

  const listTasks: IntegrationRepositoryShape["listTasks"] = (input) => {
    const limit = clampLimit(input?.limit);
    const source: IncomingTaskSource | null = input?.source ?? null;
    return sql<IncomingTaskRow>`
      SELECT
        task_id AS "id", source, source_task_id AS "sourceTaskId", title, prompt,
        project_id AS "projectId", requested_provider AS "requestedProvider",
        status, thread_id AS "threadId",
        permission_snapshot_json AS "permissionSnapshot", error,
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM incoming_tasks
      WHERE (${source} IS NULL OR source = ${source})
      ORDER BY created_at DESC, task_id DESC
      LIMIT ${limit}
    `.pipe(
      Effect.mapError(toPersistenceSqlError("IntegrationRepository.listTasks")),
      Effect.flatMap((rows) => Effect.forEach(rows, toTask)),
    );
  };

  return {
    getOpenClawConfig,
    saveOpenClawConfig,
    getLangGraphConfig,
    saveLangGraphConfig,
    createTask,
    saveTask,
    getTaskById,
    getTaskBySourceId,
    getTaskByThreadId,
    listTasks,
  } satisfies IntegrationRepositoryShape;
});

export const IntegrationRepositoryLive = Layer.effect(
  IntegrationRepository,
  makeIntegrationRepository,
);
