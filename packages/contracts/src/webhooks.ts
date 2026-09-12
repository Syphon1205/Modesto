import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString, TrimmedString } from "./baseSchemas.ts";

export const WebhookDeliveryStatus = Schema.Literals([
  "queued",
  "processing",
  "dispatched",
  "rejected",
]);
export type WebhookDeliveryStatus = typeof WebhookDeliveryStatus.Type;

export const WebhookSummary = Schema.Struct({
  id: TrimmedNonEmptyString,
  automationId: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  path: TrimmedNonEmptyString,
  enabled: Schema.Boolean,
  lastDeliveryAt: Schema.NullOr(Schema.Number),
  lastDeliveryStatus: Schema.NullOr(WebhookDeliveryStatus),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
});
export type WebhookSummary = typeof WebhookSummary.Type;

export const WebhookListInput = Schema.Struct({});
export const WebhookListResult = Schema.Struct({ webhooks: Schema.Array(WebhookSummary) });

export const WebhookCreateInput = Schema.Struct({
  automationId: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString.check(Schema.isMaxLength(120)),
});
export type WebhookCreateInput = typeof WebhookCreateInput.Type;

export const WebhookCreateResult = Schema.Struct({
  webhook: WebhookSummary,
  /** Shown once. Modesto stores this in its mode-0600 secret store. */
  secret: TrimmedNonEmptyString,
});

export const WebhookSetEnabledInput = Schema.Struct({
  webhookId: TrimmedNonEmptyString,
  enabled: Schema.Boolean,
});
export const WebhookSetEnabledResult = Schema.Struct({ webhook: Schema.NullOr(WebhookSummary) });

export const WebhookDeleteInput = Schema.Struct({ webhookId: TrimmedNonEmptyString });
export const WebhookDeleteResult = Schema.Struct({ ok: Schema.Boolean });

export class WebhookRequestError extends Schema.TaggedErrorClass<WebhookRequestError>()(
  "WebhookRequestError",
  {
    code: Schema.Literals(["not_found", "invalid_request", "storage_failed"]),
    message: TrimmedString,
  },
) {}
