import { Effect } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS integration_settings (
      integration_id TEXT PRIMARY KEY,
      config_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS incoming_tasks (
      task_id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_task_id TEXT NOT NULL,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      project_id TEXT NOT NULL,
      requested_provider TEXT,
      status TEXT NOT NULL,
      thread_id TEXT,
      permission_snapshot_json TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (source, source_task_id)
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_incoming_tasks_history
    ON incoming_tasks (source, created_at DESC, task_id DESC)
  `;
});
