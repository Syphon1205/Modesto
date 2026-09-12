import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

/**
 * Tables backing the vendored OpenWork automations engine.
 *
 * Shapes follow `AutomationRepository` in `@modesto/openwork-automations`, so
 * the engine's own conformance suite can be run against this storage.
 *
 * Two constraints carry the correctness of the whole feature:
 *
 * - `automation_revisions` is append-only. A revision is never updated in
 *   place; changing an automation writes a new row with the next version, so a
 *   run that is already in flight keeps executing the definition it claimed.
 * - `automation_runs` has a UNIQUE index on `(automation_id, idempotency_key)`.
 *   That index *is* the claim: two replicas racing for the same occurrence both
 *   INSERT, and exactly one wins. Doing this with a SELECT-then-INSERT would
 *   let both through.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      owner_member_id TEXT NOT NULL,
      name TEXT NOT NULL,
      state TEXT NOT NULL,
      current_revision_id TEXT NOT NULL,
      next_due_at INTEGER,
      latest_run_at INTEGER,
      needs_attention_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      archived_at INTEGER
    )
  `;

  // Owner-scoped listing and the scheduler's due scan are the only read paths.
  yield* sql`
    CREATE INDEX IF NOT EXISTS automations_owner_idx
      ON automations (organization_id, owner_member_id, created_at)
  `;
  yield* sql`
    CREATE INDEX IF NOT EXISTS automations_due_idx
      ON automations (state, next_due_at)
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS automation_revisions (
      id TEXT PRIMARY KEY,
      automation_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      instructions TEXT NOT NULL,
      schedule_json TEXT NOT NULL,
      model_json TEXT NOT NULL,
      execution_target TEXT NOT NULL,
      maximum_runtime_ms INTEGER NOT NULL,
      digest TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `;
  yield* sql`
    CREATE UNIQUE INDEX IF NOT EXISTS automation_revisions_version_idx
      ON automation_revisions (automation_id, version)
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS automation_runs (
      id TEXT PRIMARY KEY,
      automation_id TEXT NOT NULL,
      revision_id TEXT NOT NULL,
      -- Denormalized from automations so a run can be authorized and listed
      -- without joining a row that may since have been archived.
      organization_id TEXT NOT NULL,
      owner_member_id TEXT NOT NULL,
      trigger TEXT NOT NULL,
      scheduled_for INTEGER,
      idempotency_key TEXT NOT NULL,
      status TEXT NOT NULL,
      lease_owner TEXT,
      lease_expires_at INTEGER,
      heartbeat_at INTEGER,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      execution_target TEXT NOT NULL,
      execution_thread_json TEXT,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      model_variant TEXT,
      started_at INTEGER,
      finished_at INTEGER,
      error_json TEXT,
      result_summary TEXT,
      usage_json TEXT NOT NULL,
      cancellation_requested INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `;

  // The claim. See the module comment: this index is what makes concurrent
  // claims safe, not the code that inserts into it.
  yield* sql`
    CREATE UNIQUE INDEX IF NOT EXISTS automation_runs_occurrence_idx
      ON automation_runs (automation_id, idempotency_key)
  `;
  yield* sql`
    CREATE INDEX IF NOT EXISTS automation_runs_automation_idx
      ON automation_runs (automation_id, created_at)
  `;
  // Lease recovery scans running rows by expiry.
  yield* sql`
    CREATE INDEX IF NOT EXISTS automation_runs_lease_idx
      ON automation_runs (status, lease_expires_at)
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS automation_run_events (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `;
  // Events are read back in order and must not duplicate on retry.
  yield* sql`
    CREATE UNIQUE INDEX IF NOT EXISTS automation_run_events_sequence_idx
      ON automation_run_events (run_id, sequence)
  `;
});
