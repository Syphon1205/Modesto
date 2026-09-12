import { NodeHttpServer } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpBody, HttpClient, HttpRouter } from "effect/unstable/http";

import {
  WEBHOOK_MAX_BODY_BYTES,
  WebhookService,
  type WebhookAdmission,
  type WebhookServiceShape,
} from "./WebhookService.ts";
import { webhookIncomingRouteLayer } from "./webhookRoute.ts";

const unused = () => Effect.die("unused webhook management method");

function mockWebhookService(admit: WebhookServiceShape["admit"]): WebhookServiceShape {
  return {
    list: unused,
    create: unused,
    setEnabled: unused,
    delete: unused,
    admit,
    claimPending: () => Effect.succeed([]),
    markDispatched: () => Effect.void,
  };
}

const postWebhook = (
  httpClient: HttpClient.HttpClient,
  input: {
    readonly webhookId: string;
    readonly body: Uint8Array;
    readonly signature?: string;
    readonly deliveryKey?: string;
    readonly contentType?: string;
  },
) =>
  httpClient.post(`/api/webhooks/incoming/${encodeURIComponent(input.webhookId)}`, {
    headers: {
      ...(input.signature ? { "x-modesto-signature": input.signature } : {}),
      ...(input.deliveryKey ? { "x-modesto-delivery": input.deliveryKey } : {}),
    },
    body: HttpBody.uint8Array(input.body, input.contentType ?? "application/json"),
  });

it.effect("admits the exact request bytes and maps webhook statuses", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const admissions: Array<{
        readonly webhookId: string;
        readonly signature: string | undefined;
        readonly body: Uint8Array;
      }> = [];
      const webhooks = mockWebhookService((input) => {
        admissions.push({
          webhookId: input.webhookId,
          signature: input.signature,
          body: input.body,
        });
        const responses: Record<string, WebhookAdmission> = {
          missing: {
            accepted: false,
            duplicate: false,
            deliveryId: null,
            reason: "not_found",
          },
          disabled: {
            accepted: false,
            duplicate: false,
            deliveryId: null,
            reason: "disabled",
          },
          unsigned: {
            accepted: false,
            duplicate: false,
            deliveryId: null,
            reason: "invalid_signature",
          },
          fresh: {
            accepted: true,
            duplicate: false,
            deliveryId: "webhook_delivery_1",
            reason: null,
          },
          again: {
            accepted: true,
            duplicate: true,
            deliveryId: "webhook_delivery_1",
            reason: null,
          },
        };
        return Effect.succeed(responses[input.webhookId] ?? responses.missing!);
      });
      yield* HttpRouter.serve(webhookIncomingRouteLayer, {
        disableListenLog: true,
        disableLogger: true,
      }).pipe(Layer.provide(Layer.succeed(WebhookService, webhooks)), Layer.build);
      const httpClient = yield* HttpClient.HttpClient;

      // Key order that JSON.stringify would reorder if the body were parsed first.
      const rawBody = new TextEncoder().encode('{"z":1,"a":2}');

      const accepted = yield* postWebhook(httpClient, {
        webhookId: "fresh",
        body: rawBody,
        signature: "sha256=deadbeef",
        deliveryKey: "delivery-1",
      });
      expect(accepted.status).toBe(202);
      expect(yield* accepted.json).toEqual({
        accepted: true,
        duplicate: false,
        deliveryId: "webhook_delivery_1",
      });
      expect(new TextDecoder().decode(admissions[0]?.body ?? new Uint8Array())).toBe(
        '{"z":1,"a":2}',
      );
      expect(admissions[0]?.signature).toBe("sha256=deadbeef");

      const duplicate = yield* postWebhook(httpClient, {
        webhookId: "again",
        body: rawBody,
        signature: "sha256=deadbeef",
      });
      expect(duplicate.status).toBe(202);
      expect(yield* duplicate.json).toEqual({
        accepted: true,
        duplicate: true,
        deliveryId: "webhook_delivery_1",
      });

      const unauthorized = yield* postWebhook(httpClient, {
        webhookId: "unsigned",
        body: rawBody,
      });
      expect(unauthorized.status).toBe(401);

      const missing = yield* postWebhook(httpClient, {
        webhookId: "missing",
        body: rawBody,
        signature: "sha256=deadbeef",
      });
      expect(missing.status).toBe(404);

      const nested = yield* httpClient.post("/api/webhooks/incoming/fresh/extra", {
        body: HttpBody.uint8Array(rawBody, "application/json"),
      });
      expect(nested.status).toBe(404);

      const disabled = yield* postWebhook(httpClient, {
        webhookId: "disabled",
        body: rawBody,
        signature: "sha256=deadbeef",
      });
      expect(disabled.status).toBe(410);

      const oversized = yield* postWebhook(httpClient, {
        webhookId: "fresh",
        body: new Uint8Array(WEBHOOK_MAX_BODY_BYTES + 1),
        signature: "sha256=deadbeef",
      });
      expect(oversized.status).toBe(413);
      expect(admissions.some((entry) => entry.body.byteLength > WEBHOOK_MAX_BODY_BYTES)).toBe(
        false,
      );
    }),
  ).pipe(Effect.provide(NodeHttpServer.layerTest)),
);
