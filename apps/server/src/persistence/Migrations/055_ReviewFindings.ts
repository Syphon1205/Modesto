import { Effect } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS review_runs (
      run_id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      finding_count INTEGER NOT NULL,
      error TEXT,
      started_at TEXT,
      finished_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS review_findings (
      finding_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      severity TEXT NOT NULL,
      file_path TEXT NOT NULL,
      start_line INTEGER,
      end_line INTEGER,
      title TEXT NOT NULL,
      explanation TEXT NOT NULL,
      suggested_fix TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES review_runs(run_id)
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_review_runs_thread
    ON review_runs (thread_id, created_at DESC, run_id DESC)
  `;
  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_review_findings_thread
    ON review_findings (thread_id, created_at DESC, finding_id DESC)
  `;
});
