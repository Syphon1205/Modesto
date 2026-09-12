import * as FileSystem from "effect/FileSystem";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { WEBHOOK_MAX_BODY_BYTES, WEBHOOK_PATH_PREFIX, WebhookService } from "./WebhookService.ts";

const json = (body: unknown, status: number) =>
  HttpServerResponse.jsonUnsafe(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });

function isMaxBytesExceeded(cause: Cause.Cause<unknown>): boolean {
  const squashed = Cause.squash(cause);
  const message =
    squashed instanceof Error
      ? `${squashed.message} ${String(squashed.cause ?? "")}`
      : String(squashed ?? "");
  return message.includes("maxBytes exceeded");
}

/** Public by design: the HMAC secret authenticates this one narrow endpoint. */
export const webhookIncomingRouteLayer = HttpRouter.add(
  "POST",
  `${WEBHOOK_PATH_PREFIX}/*`,
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const url = HttpServerRequest.toURL(request);
    if (Option.isNone(url)) return json({ error: "bad_request" }, 400);
    const webhookId = decodeURIComponent(
      url.value.pathname.slice(`${WEBHOOK_PATH_PREFIX}/`.length),
    );
    if (!webhookId || webhookId.includes("/")) return json({ error: "not_found" }, 404);

    const declaredLength = Number(request.headers["content-length"] ?? Number.NaN);
    if (Number.isFinite(declaredLength) && declaredLength > WEBHOOK_MAX_BODY_BYTES) {
      return json({ error: "payload_too_large" }, 413);
    }
    const body = new Uint8Array(yield* request.arrayBuffer);
    if (body.byteLength > WEBHOOK_MAX_BODY_BYTES) {
      return json({ error: "payload_too_large" }, 413);
    }

    const webhooks = yield* WebhookService;
    const admission = yield* webhooks.admit({
      webhookId,
      signature: request.headers["x-modesto-signature"],
      deliveryKey: request.headers["x-modesto-delivery"],
      contentType: request.headers["content-type"],
      body,
    });
    if (!admission.accepted) {
      switch (admission.reason) {
        case "not_found":
          return json({ error: "not_found" }, 404);
        case "disabled":
          return json({ error: "disabled" }, 410);
        case "too_large":
          return json({ error: "payload_too_large" }, 413);
        default:
          return json({ error: "invalid_signature" }, 401);
      }
    }
    return json(
      {
        accepted: true,
        duplicate: admission.duplicate,
        deliveryId: admission.deliveryId,
      },
      202,
    );
  }).pipe(
    Effect.provideService(HttpServerRequest.MaxBodySize, FileSystem.Size(WEBHOOK_MAX_BODY_BYTES)),
    Effect.catchCause((cause) =>
      isMaxBytesExceeded(cause)
        ? Effect.succeed(json({ error: "payload_too_large" }, 413))
        : Effect.logWarning("automation.webhook.request-failed", { cause }).pipe(
            Effect.as(json({ error: "internal_error" }, 500)),
          ),
    ),
  ),
);
