import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type {
  WebhookCreateInput,
  WebhookDeliveryStatus,
  WebhookListResult,
  WebhookSetEnabledInput,
  WebhookSummary,
} from "@modesto/contracts";
import { WebhookRequestError } from "@modesto/contracts";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import { LOCAL_ORGANIZATION_ID, LOCAL_OWNER_MEMBER_ID } from "./AutomationService.ts";

export const WEBHOOK_PATH_PREFIX = "/api/webhooks/incoming";
export const WEBHOOK_MAX_BODY_BYTES = 64 * 1024;
const WEBHOOK_SECRET_PREFIX = "whsec_";

type Row = Record<string, unknown>;

const asString = (value: unknown): string => String(value);
const asNullableString = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);
const asNumber = (value: unknown): number => (typeof value === "number" ? value : Number(value));
const asNullableNumber = (value: unknown): number | null =>
  value === null || value === undefined ? null : asNumber(value);

function toSummary(row: Row): WebhookSummary {
  return {
    id: asString(row["id"]),
    automationId: asString(row["automation_id"]),
    name: asString(row["name"]),
    path: `${WEBHOOK_PATH_PREFIX}/${encodeURIComponent(asString(row["id"]))}`,
    enabled: asNumber(row["enabled"]) === 1,
    lastDeliveryAt: asNullableNumber(row["last_delivery_at"]),
    lastDeliveryStatus: asNullableString(
      row["last_delivery_status"],
    ) as WebhookDeliveryStatus | null,
    createdAt: asNumber(row["created_at"]),
    updatedAt: asNumber(row["updated_at"]),
  };
}

export interface ClaimedWebhookDelivery {
  readonly id: string;
  readonly webhookId: string;
  readonly automationId: string;
  readonly deliveryKey: string;
  readonly contentType: string | null;
  readonly body: string;
}

export interface WebhookAdmission {
  readonly accepted: boolean;
  readonly duplicate: boolean;
  readonly deliveryId: string | null;
  readonly reason: "not_found" | "disabled" | "invalid_signature" | "too_large" | null;
}

export interface WebhookServiceShape {
  readonly list: () => Effect.Effect<typeof WebhookListResult.Type, WebhookRequestError>;
  readonly create: (
    input: WebhookCreateInput,
  ) => Effect.Effect<{ webhook: WebhookSummary; secret: string }, WebhookRequestError>;
  readonly setEnabled: (
    input: typeof WebhookSetEnabledInput.Type,
  ) => Effect.Effect<WebhookSummary | null, WebhookRequestError>;
  readonly delete: (webhookId: string) => Effect.Effect<boolean, WebhookRequestError>;
  readonly admit: (input: {
    webhookId: string;
    signature: string | undefined;
    deliveryKey: string | undefined;
    contentType: string | undefined;
    body: Uint8Array;
  }) => Effect.Effect<WebhookAdmission, WebhookRequestError>;
  readonly claimPending: (input: {
    leaseOwner: string;
    leaseMs: number;
    limit: number;
  }) => Effect.Effect<ReadonlyArray<ClaimedWebhookDelivery>, WebhookRequestError>;
  readonly markDispatched: (input: {
    deliveryId: string;
    leaseOwner: string;
    runId: string | null;
    errorMessage?: string;
  }) => Effect.Effect<void, WebhookRequestError>;
}

export class WebhookService extends Context.Service<WebhookService, WebhookServiceShape>()(
  "modesto/automation/WebhookService",
) {}

const requestError = (operation: string, cause: unknown) =>
  new WebhookRequestError({
    code: "storage_failed",
    message: `Webhook ${operation} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
  });

export function webhookSignature(secret: string, body: Uint8Array): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function verifyWebhookSignature(
  secret: string,
  body: Uint8Array,
  provided: string | undefined,
): boolean {
  if (!provided) return false;
  const expected = Buffer.from(webhookSignature(secret, body));
  const actual = Buffer.from(provided.trim().toLowerCase());
  return actual.byteLength === expected.byteLength && timingSafeEqual(actual, expected);
}

export const makeWebhookService = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const crypto = yield* Crypto.Crypto;
  const secrets = yield* ServerSecretStore.ServerSecretStore;

  const attempt = <A>(operation: string, effect: Effect.Effect<A, unknown>) =>
    effect.pipe(Effect.mapError((cause) => requestError(operation, cause)));

  const list: WebhookServiceShape["list"] = () =>
    attempt(
      "list",
      sql`
        SELECT * FROM automation_webhooks
        ORDER BY created_at DESC
      `.pipe(Effect.map((rows) => ({ webhooks: (rows as ReadonlyArray<Row>).map(toSummary) }))),
    );

  const create: WebhookServiceShape["create"] = (input) =>
    Effect.gen(function* () {
      const automationRows = (yield* attempt(
        "automation lookup",
        sql`
          SELECT id FROM automations
          WHERE id = ${input.automationId}
            AND organization_id = ${LOCAL_ORGANIZATION_ID}
            AND owner_member_id = ${LOCAL_OWNER_MEMBER_ID}
            AND archived_at IS NULL
        `,
      )) as ReadonlyArray<Row>;
      if (!automationRows[0]) {
        return yield* new WebhookRequestError({
          code: "not_found",
          message: "The selected automation no longer exists.",
        });
      }

      const id = `webhook_${yield* attempt("identifier generation", crypto.randomUUIDv4)}`;
      const random = yield* crypto
        .randomBytes(32)
        .pipe(Effect.mapError((cause) => requestError("secret generation", cause)));
      const secret = `${WEBHOOK_SECRET_PREFIX}${Buffer.from(random).toString("base64url")}`;
      const secretName = `automation-webhook-${id}`;
      const now = yield* Clock.currentTimeMillis;

      yield* secrets
        .create(secretName, new TextEncoder().encode(secret))
        .pipe(Effect.mapError((cause) => requestError("secret storage", cause)));
      const inserted = yield* attempt(
        "creation",
        sql`
          INSERT INTO automation_webhooks (
            id, automation_id, name, secret_name, enabled,
            last_delivery_at, last_delivery_status, created_at, updated_at
          ) VALUES (
            ${id}, ${input.automationId}, ${input.name}, ${secretName}, 1,
            NULL, NULL, ${now}, ${now}
          )
          RETURNING *
        `,
      ).pipe(Effect.tapError(() => secrets.remove(secretName).pipe(Effect.ignore)));
      return { webhook: toSummary((inserted as ReadonlyArray<Row>)[0]!), secret };
    });

  const setEnabled: WebhookServiceShape["setEnabled"] = (input) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const rows = (yield* attempt(
        "state change",
        sql`
          UPDATE automation_webhooks
          SET enabled = ${input.enabled ? 1 : 0}, updated_at = ${now}
          WHERE id = ${input.webhookId}
          RETURNING *
        `,
      )) as ReadonlyArray<Row>;
      return rows[0] ? toSummary(rows[0]) : null;
    });

  const remove: WebhookServiceShape["delete"] = (webhookId) =>
    Effect.gen(function* () {
      const rows = (yield* attempt(
        "lookup",
        sql`SELECT secret_name FROM automation_webhooks WHERE id = ${webhookId}`,
      )) as ReadonlyArray<Row>;
      const row = rows[0];
      if (!row) return false;
      const now = yield* Clock.currentTimeMillis;
      yield* attempt(
        "delivery cancellation",
        sql`
          UPDATE automation_webhook_deliveries
          SET status = 'rejected', error_message = 'Webhook deleted.',
              lease_owner = NULL, lease_expires_at = NULL, updated_at = ${now}
          WHERE webhook_id = ${webhookId} AND status IN ('queued', 'processing')
        `,
      );
      yield* attempt("deletion", sql`DELETE FROM automation_webhooks WHERE id = ${webhookId}`);
      yield* secrets.remove(asString(row["secret_name"])).pipe(Effect.ignore);
      return true;
    });

  const admit: WebhookServiceShape["admit"] = (input) =>
    Effect.gen(function* () {
      if (input.body.byteLength > WEBHOOK_MAX_BODY_BYTES) {
        return {
          accepted: false,
          duplicate: false,
          deliveryId: null,
          reason: "too_large",
        } as const;
      }
      const rows = (yield* attempt(
        "lookup",
        sql`SELECT * FROM automation_webhooks WHERE id = ${input.webhookId}`,
      )) as ReadonlyArray<Row>;
      const webhook = rows[0];
      if (!webhook) {
        return {
          accepted: false,
          duplicate: false,
          deliveryId: null,
          reason: "not_found",
        } as const;
      }
      if (asNumber(webhook["enabled"]) !== 1) {
        return {
          accepted: false,
          duplicate: false,
          deliveryId: null,
          reason: "disabled",
        } as const;
      }
      const stored = yield* secrets
        .get(asString(webhook["secret_name"]))
        .pipe(Effect.mapError((cause) => requestError("secret lookup", cause)));
      if (Option.isNone(stored)) {
        return {
          accepted: false,
          duplicate: false,
          deliveryId: null,
          reason: "invalid_signature",
        } as const;
      }
      const secret = new TextDecoder().decode(stored.value);
      if (!verifyWebhookSignature(secret, input.body, input.signature)) {
        return {
          accepted: false,
          duplicate: false,
          deliveryId: null,
          reason: "invalid_signature",
        } as const;
      }

      const now = yield* Clock.currentTimeMillis;
      const deliveryKey =
        input.deliveryKey?.trim().slice(0, 240) ||
        createHash("sha256").update(input.body).digest("hex");
      const deliveryId = `webhook_delivery_${yield* attempt("identifier generation", crypto.randomUUIDv4)}`;
      const body = new TextDecoder().decode(input.body);
      const inserted = yield* sql`
            INSERT INTO automation_webhook_deliveries (
              id, webhook_id, delivery_key, content_type, body, status,
              run_id, error_message, lease_owner, lease_expires_at, created_at, updated_at
            ) VALUES (
              ${deliveryId}, ${input.webhookId}, ${deliveryKey}, ${input.contentType ?? null},
              ${body}, 'queued', NULL, NULL, NULL, NULL, ${now}, ${now}
            )
          `.pipe(
        Effect.as(true),
        Effect.orElseSucceed(() => false),
      );
      if (!inserted) {
        const existing = (yield* attempt(
          "deduplication",
          sql`
            SELECT id FROM automation_webhook_deliveries
            WHERE webhook_id = ${input.webhookId} AND delivery_key = ${deliveryKey}
          `,
        )) as ReadonlyArray<Row>;
        if (!existing[0]) return yield* requestError("admission", "delivery insert failed");
        return {
          accepted: true,
          duplicate: true,
          deliveryId: asString(existing[0]["id"]),
          reason: null,
        } as const;
      }
      yield* attempt(
        "delivery update",
        sql`
          UPDATE automation_webhooks
          SET last_delivery_at = ${now}, last_delivery_status = 'queued', updated_at = ${now}
          WHERE id = ${input.webhookId}
        `,
      );
      return { accepted: true, duplicate: false, deliveryId, reason: null } as const;
    });

  const claimPending: WebhookServiceShape["claimPending"] = (input) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const candidates = (yield* attempt(
        "queue scan",
        sql`
          SELECT d.*, w.automation_id
          FROM automation_webhook_deliveries d
          JOIN automation_webhooks w ON w.id = d.webhook_id
          WHERE w.enabled = 1
            AND (d.status = 'queued' OR (d.status = 'processing' AND d.lease_expires_at < ${now}))
          ORDER BY d.created_at ASC
          LIMIT ${input.limit}
        `,
      )) as ReadonlyArray<Row>;
      const claimed: ClaimedWebhookDelivery[] = [];
      for (const row of candidates) {
        const id = asString(row["id"]);
        const updated = (yield* attempt(
          "delivery claim",
          sql`
            UPDATE automation_webhook_deliveries
            SET status = 'processing', lease_owner = ${input.leaseOwner},
                lease_expires_at = ${now + input.leaseMs}, updated_at = ${now}
            WHERE id = ${id}
              AND (status = 'queued' OR (status = 'processing' AND lease_expires_at < ${now}))
            RETURNING id
          `,
        )) as ReadonlyArray<Row>;
        if (!updated[0]) continue;
        claimed.push({
          id,
          webhookId: asString(row["webhook_id"]),
          automationId: asString(row["automation_id"]),
          deliveryKey: asString(row["delivery_key"]),
          contentType: asNullableString(row["content_type"]),
          body: asString(row["body"]),
        });
      }
      return claimed;
    });

  const markDispatched: WebhookServiceShape["markDispatched"] = (input) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const status = input.errorMessage ? "rejected" : "dispatched";
      const rows = (yield* attempt(
        "delivery completion",
        sql`
          UPDATE automation_webhook_deliveries
          SET status = ${status}, run_id = ${input.runId},
              error_message = ${input.errorMessage ?? null}, lease_owner = NULL,
              lease_expires_at = NULL, updated_at = ${now}
          WHERE id = ${input.deliveryId} AND lease_owner = ${input.leaseOwner}
          RETURNING webhook_id
        `,
      )) as ReadonlyArray<Row>;
      if (rows[0]) {
        yield* attempt(
          "webhook status update",
          sql`
            UPDATE automation_webhooks
            SET last_delivery_at = ${now}, last_delivery_status = ${status}, updated_at = ${now}
            WHERE id = ${asString(rows[0]["webhook_id"])}
          `,
        );
      }
    });

  return WebhookService.of({
    list,
    create,
    setEnabled,
    delete: remove,
    admit,
    claimPending,
    markDispatched,
  });
});

export const WebhookServiceLive = Layer.effect(WebhookService, makeWebhookService);
