import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

/** Durable webhook definitions and their accepted delivery queue. */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS automation_webhooks (
      id TEXT PRIMARY KEY,
      automation_id TEXT NOT NULL,
      name TEXT NOT NULL,
      secret_name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_delivery_at INTEGER,
      last_delivery_status TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `;
  yield* sql`
    CREATE INDEX IF NOT EXISTS automation_webhooks_automation_idx
      ON automation_webhooks (automation_id, created_at)
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS automation_webhook_deliveries (
      id TEXT PRIMARY KEY,
      webhook_id TEXT NOT NULL,
      delivery_key TEXT NOT NULL,
      content_type TEXT,
      body TEXT NOT NULL,
      status TEXT NOT NULL,
      run_id TEXT,
      error_message TEXT,
      lease_owner TEXT,
      lease_expires_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `;
  yield* sql`
    CREATE UNIQUE INDEX IF NOT EXISTS automation_webhook_deliveries_dedupe_idx
      ON automation_webhook_deliveries (webhook_id, delivery_key)
  `;
  yield* sql`
    CREATE INDEX IF NOT EXISTS automation_webhook_deliveries_queue_idx
      ON automation_webhook_deliveries (status, lease_expires_at, created_at)
  `;
});
