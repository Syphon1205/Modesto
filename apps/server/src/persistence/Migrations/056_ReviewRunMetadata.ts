import { Effect } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const ensureReviewRunColumn = (columnName: string, definition: string) =>
    Effect.gen(function* () {
      const [row] = yield* sql<{ readonly exists: number }>`
        SELECT EXISTS(
          SELECT 1
          FROM pragma_table_info('review_runs')
          WHERE name = ${columnName}
        ) AS "exists"
      `;
      if (row?.exists === 1) return;
      yield* sql.unsafe(`
        ALTER TABLE review_runs
        ADD COLUMN ${definition}
      `);
    });

  yield* ensureReviewRunColumn("summary", "summary TEXT");
  yield* ensureReviewRunColumn("target_json", "target_json TEXT");
  yield* ensureReviewRunColumn("configuration_json", "configuration_json TEXT");
  yield* sql`
    UPDATE review_runs SET provider = 'modesto' WHERE provider <> 'modesto'
  `;
  yield* sql`
    UPDATE review_findings SET provider = 'modesto' WHERE provider <> 'modesto'
  `;
});
