import * as NodeServices from "@effect/platform-node/NodeServices";
import { it as effectIt } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { describe, expect, it } from "vitest";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import * as ServerConfig from "../config.ts";
import { SqlitePersistenceMemory } from "../persistence/Layers/Sqlite.ts";
import { createSqliteAutomationRepository } from "./SqliteAutomationRepository.ts";
import {
  WebhookService,
  WebhookServiceLive,
  verifyWebhookSignature,
  webhookSignature,
} from "./WebhookService.ts";

describe("webhook signatures", () => {
  it("verifies the exact request bytes and rejects tampering", () => {
    const body = new TextEncoder().encode('{"event":"push"}');
    const signature = webhookSignature("whsec_test", body);
    expect(verifyWebhookSignature("whsec_test", body, signature)).toBe(true);
    expect(
      verifyWebhookSignature("whsec_test", new TextEncoder().encode('{"event":"pull"}'), signature),
    ).toBe(false);
  });
});

const configLayer = ServerConfig.ServerConfig.layerTest(process.cwd(), {
  prefix: "modesto-webhook-service-test-",
}).pipe(Layer.provideMerge(NodeServices.layer));
const secretLayer = ServerSecretStore.layer.pipe(
  Layer.provide(configLayer),
  Layer.provideMerge(NodeServices.layer),
);
const serviceLayer = WebhookServiceLive.pipe(
  Layer.provideMerge(secretLayer),
  Layer.provideMerge(SqlitePersistenceMemory),
  Layer.provideMerge(NodeServices.layer),
  Layer.provideMerge(configLayer),
);

effectIt.layer(serviceLayer)("WebhookService", (it) => {
  it.effect("stores a signed delivery once and exposes it to the durable queue", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const service = yield* WebhookService;
      const repository = createSqliteAutomationRepository({
        sql,
        run: (effect) => Effect.runPromise(effect),
      });
      const automation = yield* Effect.promise(() =>
        Promise.resolve(
          repository.create({
            organizationId: "org_local",
            ownerMemberId: "member_local",
            definition: {
              name: "Incoming build",
              instructions: "Inspect the build event.",
              schedule: { kind: "once", timezone: "UTC", at: Date.now() + 86_400_000 },
              model: { providerId: "codex", modelId: "gpt-5.6-sol" },
            },
            now: Date.now(),
          }),
        ),
      );
      const created = yield* service.create({
        automationId: automation.automation.id,
        name: "Build complete",
      });
      const body = new TextEncoder().encode('{"status":"success"}');
      const signature = webhookSignature(created.secret, body);

      const first = yield* service.admit({
        webhookId: created.webhook.id,
        signature,
        deliveryKey: "build-42",
        contentType: "application/json",
        body,
      });
      const duplicate = yield* service.admit({
        webhookId: created.webhook.id,
        signature,
        deliveryKey: "build-42",
        contentType: "application/json",
        body,
      });
      expect(first.accepted).toBe(true);
      expect(first.duplicate).toBe(false);
      expect(duplicate.duplicate).toBe(true);

      const claimed = yield* service.claimPending({
        leaseOwner: "test-runner",
        leaseMs: 60_000,
        limit: 10,
      });
      expect(claimed).toHaveLength(1);
      expect(claimed[0]?.body).toBe('{"status":"success"}');
    }),
  );
});
