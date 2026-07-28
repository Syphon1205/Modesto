import { Effect } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

/**
 * Persists Fremont handoff return payloads and optional message provenance.
 * Both columns are JSON blobs decoded by projection schemas with NullOr defaults
 * so older rows remain readable.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const ensureColumn = (tableName: string, columnName: string, definition: string) =>
    Effect.gen(function* () {
      const [row] = yield* sql<{ readonly exists: number }>`
        SELECT EXISTS(
          SELECT 1
          FROM pragma_table_info(${tableName})
          WHERE name = ${columnName}
        ) AS "exists"
      `;
      if (row?.exists === 1) return;
      yield* sql.unsafe(`
        ALTER TABLE ${tableName}
        ADD COLUMN ${definition}
      `);
    });

  yield* ensureColumn("projection_threads", "handoff_return_json", "handoff_return_json TEXT");
  yield* ensureColumn("projection_thread_messages", "provenance_json", "provenance_json TEXT");
});
