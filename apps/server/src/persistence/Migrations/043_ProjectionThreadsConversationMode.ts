import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const columns = yield* sql<{ readonly name: string }>`
    PRAGMA table_info(projection_threads)
  `;

  if (!columns.some((column) => column.name === "conversation_mode")) {
    yield* sql`
      ALTER TABLE projection_threads
      ADD COLUMN conversation_mode TEXT NOT NULL DEFAULT 'code'
    `;
  }
});
