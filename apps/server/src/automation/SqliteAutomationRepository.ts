// FILE: SqliteAutomationRepository.ts
// Purpose: Durable storage for the vendored OpenWork automations engine.
// Layer: Server persistence adapter
//
// Implements `AutomationRepository` from `@modesto/openwork-automations`, whose
// own conformance suite is what verifies this file. The interface is
// Promise-based because it is upstream's, so this bridges Effect SQL to
// promises via an injected runner rather than reshaping the port.
//
// Two rules carry the correctness of the feature:
//
//  1. Revisions are append-only. `update` writes a new revision at the next
//     version; a run already in flight keeps executing what it claimed.
//  2. A claim is won by the UNIQUE index on (automation_id, idempotency_key),
//     not by this code. Both racing replicas INSERT and the database picks the
//     winner. A SELECT-then-INSERT would let both through, which is exactly
//     the failure upstream's conformance suite checks for.

import {
  type Automation,
  type AutomationClaimResult,
  type AutomationListItem,
  type AutomationRepository,
  type AutomationRevision,
  type AutomationRun,
  type AutomationRunEvent,
  type AutomationUsage,
  automationOccurrenceIdentity,
  automationRevisionDigest,
  AUTOMATION_MAXIMUM_ATTEMPTS,
  nextAutomationOccurrence,
} from "@modesto/openwork-automations";
import type * as Effect from "effect/Effect";
import type * as SqlClient from "effect/unstable/sql/SqlClient";

/** Runs a SQL effect. Supplied by the layer that owns the client and scope. */
export type RunSql = <A>(effect: Effect.Effect<A, unknown, never>) => Promise<A>;

type Row = Record<string, unknown>;

const asNumber = (value: unknown): number => (typeof value === "number" ? value : Number(value));
const asNullableNumber = (value: unknown): number | null =>
  value === null || value === undefined ? null : asNumber(value);
const asString = (value: unknown): string => String(value);
const asNullableString = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    // A row written by a newer build with a shape this one cannot read must not
    // take down the listing; the caller sees the fallback.
    return fallback;
  }
}

const EMPTY_USAGE: AutomationUsage = { inputTokens: null, outputTokens: null, costMicros: null };

function toAutomation(row: Row): Automation {
  return {
    id: asString(row["id"]),
    organizationId: asString(row["organization_id"]),
    ownerMemberId: asString(row["owner_member_id"]),
    name: asString(row["name"]),
    state: asString(row["state"]) as Automation["state"],
    currentRevisionId: asString(row["current_revision_id"]),
    nextDueAt: asNullableNumber(row["next_due_at"]),
    latestRunAt: asNullableNumber(row["latest_run_at"]),
    needsAttentionReason: parseJson(row["needs_attention_json"], null),
    createdAt: asNumber(row["created_at"]),
    updatedAt: asNumber(row["updated_at"]),
    archivedAt: asNullableNumber(row["archived_at"]),
  };
}

function toRevision(row: Row): AutomationRevision {
  return {
    id: asString(row["id"]),
    automationId: asString(row["automation_id"]),
    version: asNumber(row["version"]),
    instructions: asString(row["instructions"]),
    schedule: parseJson(row["schedule_json"], null as never),
    model: parseJson(row["model_json"], null as never),
    executionTarget: "desktop",
    maximumRuntimeMs: asNumber(row["maximum_runtime_ms"]),
    digest: asString(row["digest"]),
    createdAt: asNumber(row["created_at"]),
  };
}

function toRun(row: Row): AutomationRun {
  return {
    id: asString(row["id"]),
    automationId: asString(row["automation_id"]),
    revisionId: asString(row["revision_id"]),
    trigger: asString(row["trigger"]) as AutomationRun["trigger"],
    scheduledFor: asNullableNumber(row["scheduled_for"]),
    idempotencyKey: asString(row["idempotency_key"]),
    status: asString(row["status"]) as AutomationRun["status"],
    leaseOwner: asNullableString(row["lease_owner"]),
    leaseExpiresAt: asNullableNumber(row["lease_expires_at"]),
    heartbeatAt: asNullableNumber(row["heartbeat_at"]),
    attemptCount: asNumber(row["attempt_count"]),
    executionTarget: "desktop",
    executionThread: parseJson(row["execution_thread_json"], null),
    providerId: asString(row["provider_id"]),
    modelId: asString(row["model_id"]),
    modelVariant: asNullableString(row["model_variant"]),
    startedAt: asNullableNumber(row["started_at"]),
    finishedAt: asNullableNumber(row["finished_at"]),
    error: parseJson(row["error_json"], null),
    resultSummary: asNullableString(row["result_summary"]),
    usage: parseJson(row["usage_json"], EMPTY_USAGE),
    createdAt: asNumber(row["created_at"]),
    updatedAt: asNumber(row["updated_at"]),
  };
}

/** Ids are opaque to the engine; only stability and uniqueness matter. */
function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

const DEFAULT_MAXIMUM_RUNTIME_MS = 10 * 60 * 1_000;

export function createSqliteAutomationRepository(input: {
  readonly sql: SqlClient.SqlClient;
  readonly run: RunSql;
}): AutomationRepository {
  const { sql, run } = input;

  const readItem = async (automationId: string): Promise<AutomationListItem | null> => {
    const rows = (await run(
      sql`SELECT * FROM automations WHERE id = ${automationId}`,
    )) as ReadonlyArray<Row>;
    const automationRow = rows[0];
    if (!automationRow) return null;
    const automation = toAutomation(automationRow);
    const revisionRows = (await run(
      sql`SELECT * FROM automation_revisions WHERE id = ${automation.currentRevisionId}`,
    )) as ReadonlyArray<Row>;
    const revisionRow = revisionRows[0];
    if (!revisionRow) return null;
    const runRows = (await run(
      sql`
        SELECT * FROM automation_runs
        WHERE automation_id = ${automationId}
        ORDER BY created_at DESC, rowid DESC
        LIMIT 1
      `,
    )) as ReadonlyArray<Row>;
    return {
      automation,
      revision: toRevision(revisionRow),
      latestRun: runRows[0] ? toRun(runRows[0]) : null,
    };
  };

  const requireItem = async (automationId: string): Promise<AutomationListItem> => {
    const item = await readItem(automationId);
    if (!item) throw new Error(`Unknown automation: ${automationId}`);
    return item;
  };

  const insertRevision = async (fields: {
    automationId: string;
    version: number;
    instructions: string;
    schedule: AutomationRevision["schedule"];
    model: AutomationRevision["model"];
    maximumRuntimeMs: number;
    now: number;
  }): Promise<string> => {
    const revisionId = newId("automation_revision");
    const digest = automationRevisionDigest({
      instructions: fields.instructions,
      schedule: fields.schedule,
      model: fields.model,
      maximumRuntimeMs: fields.maximumRuntimeMs,
    });
    await run(
      sql`
        INSERT INTO automation_revisions (
          id, automation_id, version, instructions, schedule_json, model_json,
          execution_target, maximum_runtime_ms, digest, created_at
        ) VALUES (
          ${revisionId}, ${fields.automationId}, ${fields.version}, ${fields.instructions},
          ${JSON.stringify(fields.schedule)}, ${JSON.stringify(fields.model)},
          'desktop', ${fields.maximumRuntimeMs}, ${digest}, ${fields.now}
        )
      `,
    );
    return revisionId;
  };

  const EXHAUSTED_RECOVERY_ERROR = {
    code: "execution_runtime_unavailable" as const,
    message: "The automation run exceeded its recovery attempts after a runner crash.",
    retryable: false,
  };

  const failExhaustedRun = async (runId: string, now: number): Promise<void> => {
    await run(
      sql`
        UPDATE automation_runs
        SET status = 'failed',
            error_json = ${JSON.stringify(EXHAUSTED_RECOVERY_ERROR)},
            lease_owner = NULL,
            lease_expires_at = NULL,
            finished_at = ${now},
            updated_at = ${now}
        WHERE id = ${runId}
          AND status = 'running'
          AND lease_expires_at IS NOT NULL
          AND lease_expires_at < ${now}
      `,
    );
  };

  const takeOverExpiredRun = async (input: {
    runId: string;
    leaseOwner: string;
    leaseMs: number;
    now: number;
    attemptCount: number;
  }): Promise<AutomationRun | null> => {
    if (input.attemptCount >= AUTOMATION_MAXIMUM_ATTEMPTS) {
      await failExhaustedRun(input.runId, input.now);
      return null;
    }
    const rows = (await run(
      sql`
        UPDATE automation_runs
        SET lease_owner = ${input.leaseOwner},
            lease_expires_at = ${input.now + input.leaseMs},
            heartbeat_at = ${input.now},
            attempt_count = MIN(attempt_count + 1, ${AUTOMATION_MAXIMUM_ATTEMPTS}),
            updated_at = ${input.now}
        WHERE id = ${input.runId}
          AND status = 'running'
          AND lease_expires_at IS NOT NULL
          AND lease_expires_at < ${input.now}
        RETURNING *
      `,
    )) as ReadonlyArray<Row>;
    return rows[0] ? toRun(rows[0]) : null;
  };

  return {
    create: async ({ organizationId, ownerMemberId, definition, now }) => {
      const automationId = newId("automation");
      // Not caller-supplied: the runtime cap is server policy, so a definition
      // cannot ask for a longer run than this deployment allows.
      const maximumRuntimeMs = DEFAULT_MAXIMUM_RUNTIME_MS;
      const revisionId = await insertRevision({
        automationId,
        version: 1,
        instructions: definition.instructions,
        schedule: definition.schedule,
        model: definition.model,
        maximumRuntimeMs,
        now,
      });
      // Without this the automation is stored but never becomes due, so the
      // scheduler would never pick it up - it would look saved and do nothing.
      const nextDueAt = nextAutomationOccurrence(definition.schedule, now);
      await run(
        sql`
          INSERT INTO automations (
            id, organization_id, owner_member_id, name, state, current_revision_id,
            next_due_at, latest_run_at, needs_attention_json, created_at, updated_at, archived_at
          ) VALUES (
            ${automationId}, ${organizationId}, ${ownerMemberId}, ${definition.name}, 'active',
            ${revisionId}, ${nextDueAt}, NULL, NULL, ${now}, ${now}, NULL
          )
        `,
      );
      return requireItem(automationId);
    },

    update: async ({ organizationId, ownerMemberId, automationId, changes, now }) => {
      const current = await readItem(automationId);
      if (
        !current ||
        current.automation.organizationId !== organizationId ||
        current.automation.ownerMemberId !== ownerMemberId
      ) {
        throw new Error(`Unknown automation: ${automationId}`);
      }
      // Append-only: a new revision, never an edit of the claimed one.
      const revisionId = await insertRevision({
        automationId,
        version: current.revision.version + 1,
        instructions: changes.instructions ?? current.revision.instructions,
        schedule: changes.schedule ?? current.revision.schedule,
        model: changes.model ?? current.revision.model,
        maximumRuntimeMs: current.revision.maximumRuntimeMs,
        now,
      });
      // Recomputed from the *new* revision: editing a schedule that no longer
      // matches the stored due time is how an automation silently stops firing.
      const schedule = changes.schedule ?? current.revision.schedule;
      const nextDueAt = nextAutomationOccurrence(schedule, now);
      await run(
        sql`
          UPDATE automations
          SET name = ${changes.name ?? current.automation.name},
              current_revision_id = ${revisionId},
              next_due_at = ${nextDueAt},
              updated_at = ${now}
          WHERE id = ${automationId}
        `,
      );
      return requireItem(automationId);
    },

    get: async ({ organizationId, ownerMemberId, automationId }) => {
      const item = await readItem(automationId);
      // Isolation is enforced on read, not by trusting the caller's scope.
      if (
        !item ||
        item.automation.organizationId !== organizationId ||
        item.automation.ownerMemberId !== ownerMemberId
      ) {
        return null;
      }
      return item;
    },

    list: async ({ organizationId, ownerMemberId, limit }) => {
      const rows = (await run(
        sql`
          SELECT id FROM automations
          WHERE organization_id = ${organizationId}
            AND owner_member_id = ${ownerMemberId}
            AND state <> 'archived'
          ORDER BY created_at DESC, rowid DESC
          LIMIT ${limit}
        `,
      )) as ReadonlyArray<Row>;
      const items: AutomationListItem[] = [];
      for (const row of rows) {
        const item = await readItem(asString(row["id"]));
        if (item) items.push(item);
      }
      return { items, nextCursor: null };
    },

    setState: async ({ organizationId, ownerMemberId, automationId, state, now }) => {
      const item = await readItem(automationId);
      if (
        !item ||
        item.automation.organizationId !== organizationId ||
        item.automation.ownerMemberId !== ownerMemberId
      ) {
        return null;
      }
      await run(
        sql`
          UPDATE automations
          SET state = ${state},
              archived_at = ${state === "archived" ? now : null},
              updated_at = ${now}
          WHERE id = ${automationId}
        `,
      );
      return requireItem(automationId);
    },

    listDue: async ({ now, limit }) => {
      const rows = (await run(
        sql`
          SELECT id FROM automations
          WHERE state = 'active' AND next_due_at IS NOT NULL AND next_due_at <= ${now}
          ORDER BY next_due_at ASC
          LIMIT ${limit}
        `,
      )) as ReadonlyArray<Row>;
      const items: AutomationListItem[] = [];
      for (const row of rows) {
        const item = await readItem(asString(row["id"]));
        if (item) items.push(item);
      }
      return items;
    },

    claim: async ({
      automation,
      revision,
      trigger,
      scheduledFor,
      nonce,
      leaseOwner,
      leaseMs,
      now,
    }) => {
      const identity = automationOccurrenceIdentity({
        automationId: automation.id,
        scheduledFor,
        ...(nonce === undefined ? {} : { nonce }),
      });
      const runId = newId("automation_run");
      try {
        // The UNIQUE index decides the winner. A loser surfaces as a
        // constraint violation, which is the intended, expected path.
        await run(
          sql`
            INSERT INTO automation_runs (
              id, automation_id, revision_id, organization_id, owner_member_id, trigger,
              scheduled_for, idempotency_key, status, lease_owner, lease_expires_at,
              heartbeat_at, attempt_count, execution_target, execution_thread_json,
              provider_id, model_id, model_variant, started_at, finished_at, error_json,
              result_summary, usage_json, cancellation_requested, created_at, updated_at
            ) VALUES (
              ${runId}, ${automation.id}, ${revision.id}, ${automation.organizationId},
              ${automation.ownerMemberId}, ${trigger}, ${scheduledFor},
              ${identity.idempotencyKey}, 'running', ${leaseOwner}, ${now + leaseMs},
              ${now}, 1, 'desktop', NULL, ${revision.model.providerId}, ${revision.model.modelId},
              NULL, ${now}, NULL, NULL, NULL, ${JSON.stringify(EMPTY_USAGE)}, 0, ${now}, ${now}
            )
          `,
        );
      } catch {
        const existingRows = (await run(
          sql`
            SELECT * FROM automation_runs
            WHERE automation_id = ${automation.id}
              AND idempotency_key = ${identity.idempotencyKey}
          `,
        )) as ReadonlyArray<Row>;
        const existing = existingRows[0];
        if (!existing) throw new Error("Automation claim failed without a conflicting run");
        const existingRun = toRun(existing);
        if (existingRun.status === "running" && (existingRun.leaseExpiresAt ?? 0) <= now) {
          const takenOver = await takeOverExpiredRun({
            runId: existingRun.id,
            leaseOwner,
            leaseMs,
            now,
            attemptCount: existingRun.attemptCount,
          });
          if (takenOver) return { kind: "claimed", run: takenOver, revision };
        }
        // "duplicate" means the same occurrence was already recorded;
        // "overlap" means a different run for it is still holding a lease.
        return {
          kind:
            existingRun.status === "running" && (existingRun.leaseExpiresAt ?? 0) > now
              ? "overlap"
              : "duplicate",
          run: existingRun,
        } satisfies AutomationClaimResult;
      }
      await run(
        sql`UPDATE automations SET latest_run_at = ${now}, updated_at = ${now} WHERE id = ${automation.id}`,
      );
      const claimedRows = (await run(
        sql`SELECT * FROM automation_runs WHERE id = ${runId}`,
      )) as ReadonlyArray<Row>;
      return { kind: "claimed", run: toRun(claimedRows[0]!), revision };
    },

    heartbeat: async ({ runId, leaseOwner, leaseMs, now }) => {
      // Scoped to the lease owner: a replica that lost its lease must not be
      // able to extend it and resume writing.
      await run(
        sql`
          UPDATE automation_runs
          SET lease_expires_at = ${now + leaseMs}, heartbeat_at = ${now}, updated_at = ${now}
          WHERE id = ${runId} AND lease_owner = ${leaseOwner} AND status = 'running'
        `,
      );
      const rows = (await run(
        sql`SELECT heartbeat_at FROM automation_runs WHERE id = ${runId} AND lease_owner = ${leaseOwner}`,
      )) as ReadonlyArray<Row>;
      return rows[0] !== undefined && asNullableNumber(rows[0]["heartbeat_at"]) === now;
    },

    appendEvent: async ({ runId, type, payload, now }) => {
      const rows = (await run(
        sql`SELECT COALESCE(MAX(sequence), 0) AS next FROM automation_run_events WHERE run_id = ${runId}`,
      )) as ReadonlyArray<Row>;
      const sequence = asNumber(rows[0]?.["next"] ?? 0) + 1;
      const eventId = newId("automation_run_event");
      await run(
        sql`
          INSERT INTO automation_run_events (id, run_id, sequence, type, payload_json, created_at)
          VALUES (${eventId}, ${runId}, ${sequence}, ${type}, ${JSON.stringify(payload)}, ${now})
        `,
      );
      return {
        id: eventId,
        runId,
        sequence,
        type,
        payload,
        createdAt: now,
      } as AutomationRunEvent;
    },

    complete: async ({ runId, leaseOwner, status, resultSummary, usage, error, attempt, now }) => {
      await run(
        sql`
          UPDATE automation_runs
          SET status = ${status},
              result_summary = ${resultSummary},
              usage_json = ${JSON.stringify(usage)},
              error_json = ${error === null ? null : JSON.stringify(error)},
              attempt_count = ${attempt ?? 1},
              finished_at = ${now},
              lease_owner = NULL,
              lease_expires_at = NULL,
              updated_at = ${now}
          WHERE id = ${runId} AND lease_owner = ${leaseOwner}
        `,
      );
      const rows = (await run(
        sql`SELECT * FROM automation_runs WHERE id = ${runId}`,
      )) as ReadonlyArray<Row>;
      if (!rows[0]) throw new Error(`Unknown automation run: ${runId}`);
      return toRun(rows[0]);
    },

    recoverExpiredLeases: async ({ now, limit, leaseOwner, leaseMs }) => {
      await run(
        sql`
          UPDATE automation_runs
          SET status = 'failed',
              error_json = ${JSON.stringify(EXHAUSTED_RECOVERY_ERROR)},
              lease_owner = NULL,
              lease_expires_at = NULL,
              finished_at = ${now},
              updated_at = ${now}
          WHERE status = 'running'
            AND lease_expires_at IS NOT NULL
            AND lease_expires_at < ${now}
            AND attempt_count >= ${AUTOMATION_MAXIMUM_ATTEMPTS}
        `,
      );
      const rows = (await run(
        sql`
          SELECT * FROM automation_runs
          WHERE status = 'running'
            AND lease_expires_at IS NOT NULL
            AND lease_expires_at < ${now}
            AND attempt_count < ${AUTOMATION_MAXIMUM_ATTEMPTS}
          ORDER BY lease_expires_at ASC
          LIMIT ${limit}
        `,
      )) as ReadonlyArray<Row>;
      const items: AutomationListItem[] = [];
      for (const row of rows) {
        const recovered = await takeOverExpiredRun({
          runId: asString(row["id"]),
          leaseOwner,
          leaseMs,
          now,
          attemptCount: asNumber(row["attempt_count"]),
        });
        if (!recovered) continue;
        const item = await readItem(recovered.automationId);
        if (!item) continue;
        const revisionRows = (await run(
          sql`SELECT * FROM automation_revisions WHERE id = ${recovered.revisionId}`,
        )) as ReadonlyArray<Row>;
        items.push({
          ...item,
          revision: revisionRows[0] ? toRevision(revisionRows[0]) : item.revision,
          latestRun: recovered,
        });
      }
      return items;
    },

    requestCancellation: async ({ organizationId, ownerMemberId, runId, now }) => {
      const rows = (await run(
        sql`
          SELECT * FROM automation_runs
          WHERE id = ${runId}
            AND organization_id = ${organizationId}
            AND owner_member_id = ${ownerMemberId}
        `,
      )) as ReadonlyArray<Row>;
      if (!rows[0]) return null;
      // A request, not a transition: the runner observes the flag and
      // terminalizes the run itself, so cancellation stays cooperative.
      await run(
        sql`UPDATE automation_runs SET cancellation_requested = 1, updated_at = ${now} WHERE id = ${runId}`,
      );
      const updated = (await run(
        sql`SELECT * FROM automation_runs WHERE id = ${runId}`,
      )) as ReadonlyArray<Row>;
      return updated[0] ? toRun(updated[0]) : null;
    },

    getRunReceipt: async ({ organizationId, ownerMemberId, runId }) => {
      const rows = (await run(
        sql`
          SELECT * FROM automation_runs
          WHERE id = ${runId}
            AND organization_id = ${organizationId}
            AND owner_member_id = ${ownerMemberId}
        `,
      )) as ReadonlyArray<Row>;
      if (!rows[0]) return null;
      const eventRows = (await run(
        sql`SELECT * FROM automation_run_events WHERE run_id = ${runId} ORDER BY sequence ASC`,
      )) as ReadonlyArray<Row>;
      return {
        run: toRun(rows[0]),
        events: eventRows.map((row) => ({
          id: asString(row["id"]),
          runId,
          sequence: asNumber(row["sequence"]),
          type: asString(row["type"]),
          payload: parseJson(row["payload_json"], {}),
          createdAt: asNumber(row["created_at"]),
        })),
      } as never;
    },

    listRuns: async ({ organizationId, ownerMemberId, automationId, limit }) => {
      const rows = (await run(
        sql`
          SELECT * FROM automation_runs
          WHERE automation_id = ${automationId}
            AND organization_id = ${organizationId}
            AND owner_member_id = ${ownerMemberId}
          ORDER BY created_at DESC, rowid DESC
          LIMIT ${limit}
        `,
      )) as ReadonlyArray<Row>;
      return { items: rows.map(toRun), nextCursor: null };
    },
  };
}
