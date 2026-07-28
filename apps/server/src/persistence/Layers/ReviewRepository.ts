import { ReviewFinding, ReviewFindingId, ReviewRun, ReviewRunId } from "@modesto/contracts";
import { Effect, Layer, Option, Schema } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import {
  PersistenceDecodeError,
  toPersistenceDecodeCauseError,
  toPersistenceDecodeError,
  toPersistenceSqlError,
} from "../Errors.ts";
import { ReviewRepository, type ReviewRepositoryShape } from "../Services/ReviewRepository.ts";

const decodeRun = Schema.decodeUnknownEffect(ReviewRun);
const decodeFinding = Schema.decodeUnknownEffect(ReviewFinding);

type RunRow = {
  readonly id: string;
  readonly threadId: string;
  readonly projectId: string;
  readonly provider: string;
  readonly status: string;
  readonly targetJson: string | null;
  readonly configurationJson: string | null;
  readonly findingCount: number;
  readonly summary: string | null;
  readonly error: string | null;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type FindingRow = {
  readonly id: string;
  readonly runId: string;
  readonly threadId: string;
  readonly provider: string;
  readonly severity: string;
  readonly file: string;
  readonly startLine: number | null;
  readonly endLine: number | null;
  readonly title: string;
  readonly explanation: string;
  readonly suggestedFix: string | null;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

const toRun = (row: RunRow) =>
  Effect.try({
    try: () => ({
      id: row.id,
      threadId: row.threadId,
      projectId: row.projectId,
      provider: row.provider,
      status: row.status,
      target: row.targetJson ? JSON.parse(row.targetJson) : null,
      configuration: row.configurationJson ? JSON.parse(row.configurationJson) : null,
      findingCount: row.findingCount,
      summary: row.summary,
      error: row.error,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }),
    catch: toPersistenceDecodeCauseError("ReviewRepository.runRowToDomain"),
  }).pipe(
    Effect.flatMap(decodeRun),
    Effect.mapError((error) =>
      Schema.is(PersistenceDecodeError)(error)
        ? error
        : toPersistenceDecodeError("ReviewRepository.runRowToDomain")(error),
    ),
  );
const toFinding = (row: FindingRow) =>
  decodeFinding(row).pipe(
    Effect.mapError(toPersistenceDecodeError("ReviewRepository.findingRowToDomain")),
  );

const makeReviewRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const createRun: ReviewRepositoryShape["createRun"] = (run) =>
    sql`
      INSERT INTO review_runs (
        run_id, thread_id, project_id, provider, status, target_json, configuration_json,
        finding_count, summary, error, started_at, finished_at, created_at, updated_at
      ) VALUES (
        ${run.id}, ${run.threadId}, ${run.projectId}, ${run.provider}, ${run.status},
        ${run.target ? JSON.stringify(run.target) : null},
        ${run.configuration ? JSON.stringify(run.configuration) : null},
        ${run.findingCount}, ${run.summary}, ${run.error}, ${run.startedAt}, ${run.finishedAt},
        ${run.createdAt}, ${run.updatedAt}
      )
    `.pipe(Effect.as(run), Effect.mapError(toPersistenceSqlError("ReviewRepository.createRun")));

  const saveRun: ReviewRepositoryShape["saveRun"] = (run) =>
    sql`
      UPDATE review_runs SET
        status = ${run.status}, target_json = ${run.target ? JSON.stringify(run.target) : null},
        configuration_json = ${run.configuration ? JSON.stringify(run.configuration) : null},
        finding_count = ${run.findingCount}, summary = ${run.summary},
        error = ${run.error},
        started_at = ${run.startedAt}, finished_at = ${run.finishedAt},
        updated_at = ${run.updatedAt}
      WHERE run_id = ${run.id}
    `.pipe(Effect.as(run), Effect.mapError(toPersistenceSqlError("ReviewRepository.saveRun")));

  const getRun: ReviewRepositoryShape["getRun"] = (id) =>
    sql<RunRow>`
      SELECT run_id AS "id", thread_id AS "threadId", project_id AS "projectId",
        provider, status, target_json AS "targetJson",
        configuration_json AS "configurationJson", finding_count AS "findingCount", summary, error,
        started_at AS "startedAt", finished_at AS "finishedAt",
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM review_runs WHERE run_id = ${id} LIMIT 1
    `.pipe(
      Effect.mapError(toPersistenceSqlError("ReviewRepository.getRun")),
      Effect.flatMap((rows) => {
        const row = rows[0];
        return row ? toRun(row).pipe(Effect.map(Option.some)) : Effect.succeed(Option.none());
      }),
    );

  const resolveConditionalRun = (run: ReviewRun, rows: ReadonlyArray<RunRow>) => {
    const row = rows[0];
    if (row) return toRun(row);
    return getRun(run.id).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () =>
            Effect.fail(
              toPersistenceSqlError("ReviewRepository.saveRunIfActive")(
                new Error(`Review run ${run.id} was not found.`),
              ),
            ),
          onSome: Effect.succeed,
        }),
      ),
    );
  };

  const saveRunIfActive: ReviewRepositoryShape["saveRunIfActive"] = (run) =>
    (run.status === "cancelled"
      ? sql<RunRow>`
          UPDATE review_runs SET
            status = 'cancelled',
            target_json = ${run.target ? JSON.stringify(run.target) : null},
            configuration_json = ${run.configuration ? JSON.stringify(run.configuration) : null},
            finding_count = MAX(finding_count, ${run.findingCount}),
            summary = COALESCE(${run.summary}, summary),
            error = NULL,
            started_at = COALESCE(started_at, ${run.startedAt}),
            finished_at = ${run.finishedAt},
            updated_at = ${run.updatedAt}
          WHERE run_id = ${run.id} AND status IN ('queued', 'running', 'cancelled')
          RETURNING
            run_id AS "id", thread_id AS "threadId", project_id AS "projectId",
            provider, status, target_json AS "targetJson",
            configuration_json AS "configurationJson", finding_count AS "findingCount",
            summary, error, started_at AS "startedAt", finished_at AS "finishedAt",
            created_at AS "createdAt", updated_at AS "updatedAt"
        `
      : sql<RunRow>`
          UPDATE review_runs SET
            status = ${run.status},
            target_json = ${run.target ? JSON.stringify(run.target) : null},
            configuration_json = ${run.configuration ? JSON.stringify(run.configuration) : null},
            finding_count = ${run.findingCount}, summary = ${run.summary},
            error = ${run.error},
            started_at = ${run.startedAt}, finished_at = ${run.finishedAt},
            updated_at = ${run.updatedAt}
          WHERE run_id = ${run.id} AND status IN ('queued', 'running')
          RETURNING
            run_id AS "id", thread_id AS "threadId", project_id AS "projectId",
            provider, status, target_json AS "targetJson",
            configuration_json AS "configurationJson", finding_count AS "findingCount",
            summary, error, started_at AS "startedAt", finished_at AS "finishedAt",
            created_at AS "createdAt", updated_at AS "updatedAt"
        `
    ).pipe(
      Effect.mapError(toPersistenceSqlError("ReviewRepository.saveRunIfActive")),
      Effect.flatMap((rows) => resolveConditionalRun(run, rows)),
    );

  const failStaleActiveRuns: ReviewRepositoryShape["failStaleActiveRuns"] = (updatedAt) =>
    sql`
      UPDATE review_runs SET
        status = 'failed',
        error = 'Review interrupted by a previous Modesto shutdown.',
        finished_at = ${updatedAt},
        updated_at = ${updatedAt}
      WHERE status IN ('queued', 'running')
    `.pipe(
      Effect.asVoid,
      Effect.mapError(toPersistenceSqlError("ReviewRepository.failStaleActiveRuns")),
    );

  const createFinding: ReviewRepositoryShape["createFinding"] = (finding) =>
    sql`
      INSERT INTO review_findings (
        finding_id, run_id, thread_id, provider, severity, file_path,
        start_line, end_line, title, explanation, suggested_fix,
        status, created_at, updated_at
      ) VALUES (
        ${finding.id}, ${finding.runId}, ${finding.threadId}, ${finding.provider},
        ${finding.severity}, ${finding.file}, ${finding.startLine}, ${finding.endLine},
        ${finding.title}, ${finding.explanation}, ${finding.suggestedFix},
        ${finding.status}, ${finding.createdAt}, ${finding.updatedAt}
      )
    `.pipe(
      Effect.as(finding),
      Effect.mapError(toPersistenceSqlError("ReviewRepository.createFinding")),
    );

  const getFinding = (id: ReviewFindingId) =>
    sql<FindingRow>`
      SELECT finding_id AS "id", run_id AS "runId", thread_id AS "threadId",
        provider, severity, file_path AS "file", start_line AS "startLine",
        end_line AS "endLine", title, explanation, suggested_fix AS "suggestedFix",
        status, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM review_findings WHERE finding_id = ${id} LIMIT 1
    `.pipe(
      Effect.mapError(toPersistenceSqlError("ReviewRepository.getFinding")),
      Effect.flatMap((rows) => {
        const row = rows[0];
        return row ? toFinding(row).pipe(Effect.map(Option.some)) : Effect.succeed(Option.none());
      }),
    );

  const setFindingIgnored: ReviewRepositoryShape["setFindingIgnored"] = (input) =>
    sql`
      UPDATE review_findings
      SET status = ${input.ignored ? "ignored" : "open"}, updated_at = ${input.updatedAt}
      WHERE finding_id = ${input.id}
    `.pipe(
      Effect.mapError(toPersistenceSqlError("ReviewRepository.setFindingIgnored")),
      Effect.flatMap(() => getFinding(input.id)),
      Effect.flatMap(
        Option.match({
          onNone: () =>
            Effect.fail(
              toPersistenceSqlError("ReviewRepository.setFindingIgnored")(
                new Error(`Review finding ${input.id} was not found.`),
              ),
            ),
          onSome: Effect.succeed,
        }),
      ),
    );

  const listRuns: ReviewRepositoryShape["listRuns"] = (threadId) =>
    sql<RunRow>`
      SELECT run_id AS "id", thread_id AS "threadId", project_id AS "projectId",
        provider, status, target_json AS "targetJson",
        configuration_json AS "configurationJson", finding_count AS "findingCount", summary, error,
        started_at AS "startedAt", finished_at AS "finishedAt",
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM review_runs WHERE thread_id = ${threadId} AND provider = 'modesto'
      ORDER BY created_at DESC, run_id DESC LIMIT 100
    `.pipe(
      Effect.mapError(toPersistenceSqlError("ReviewRepository.listRuns")),
      Effect.flatMap((rows) => Effect.forEach(rows, toRun)),
    );

  const listFindings: ReviewRepositoryShape["listFindings"] = (threadId) =>
    sql<FindingRow>`
      SELECT finding_id AS "id", run_id AS "runId", thread_id AS "threadId",
        provider, severity, file_path AS "file", start_line AS "startLine",
        end_line AS "endLine", title, explanation, suggested_fix AS "suggestedFix",
        status, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM review_findings WHERE thread_id = ${threadId} AND provider = 'modesto'
      ORDER BY created_at DESC, finding_id DESC LIMIT 500
    `.pipe(
      Effect.mapError(toPersistenceSqlError("ReviewRepository.listFindings")),
      Effect.flatMap((rows) => Effect.forEach(rows, toFinding)),
    );

  return {
    createRun,
    saveRun,
    saveRunIfActive,
    failStaleActiveRuns,
    getRun,
    createFinding,
    setFindingIgnored,
    listRuns,
    listFindings,
  } satisfies ReviewRepositoryShape;
});

export const ReviewRepositoryLive = Layer.effect(ReviewRepository, makeReviewRepository);
