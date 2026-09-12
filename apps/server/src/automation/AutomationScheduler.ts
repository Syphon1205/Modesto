// FILE: AutomationScheduler.ts
// Purpose: Starts the automation runner with the server and keeps it ticking.
// Layer: Server automation
//
// The pieces either side of this file are testable on their own -
// `AutomationRunner` against the real repository, `AutomationTurnDispatcher`'s
// completion watching against a synthetic event stream. This is the assembly:
// it builds the repository over the live SQL client, hands the runner the real
// dispatcher, and parks the loop behind server activation the same way the
// provider session reaper does, so a starting server does no scheduled work
// before it is ready to serve.
//
// The lease owner identifies this process. It is generated per boot rather
// than persisted: a lease is only meaningful while its owner is alive, and a
// stable id reused after a crash would let a restarted server mistake a lease
// it no longer holds for its own.

import * as Crypto from "effect/Crypto";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Context from "effect/Context";

import { ServerConfig } from "../config.ts";
import { OrchestrationEngineService } from "../orchestration/Services/OrchestrationEngine.ts";
import { forkParked } from "../serverActivation.ts";
import {
  DEFAULT_TICK_INTERVAL_MS,
  makeAutomationRunner,
  type AutomationRunnerOptions,
} from "./AutomationRunner.ts";
import { makeAutomationTurnDispatcher } from "./AutomationTurnDispatcher.ts";
import { createSqliteAutomationRepository } from "./SqliteAutomationRepository.ts";
import { LOCAL_ORGANIZATION_ID, LOCAL_OWNER_MEMBER_ID } from "./AutomationService.ts";
import { WebhookService } from "./WebhookService.ts";

export interface AutomationSchedulerShape {
  /** Begins ticking. Parked until the server activates; stops with the scope. */
  readonly start: () => Effect.Effect<void, never, import("effect/Scope").Scope>;
}

export class AutomationScheduler extends Context.Service<
  AutomationScheduler,
  AutomationSchedulerShape
>()("t3/automation/AutomationScheduler") {}

export interface AutomationSchedulerLiveOptions {
  readonly tickIntervalMs?: number;
  readonly runnerOptions?: Partial<Omit<AutomationRunnerOptions, "repository" | "dispatcher">>;
}

const makeAutomationScheduler = (options?: AutomationSchedulerLiveOptions) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const crypto = yield* Crypto.Crypto;
    const config = yield* ServerConfig;
    const engine = yield* OrchestrationEngineService;
    const webhooks = yield* WebhookService;
    const tickIntervalMs = Math.max(1, options?.tickIntervalMs ?? DEFAULT_TICK_INTERVAL_MS);

    const repository = createSqliteAutomationRepository({
      sql,
      run: (effect) => Effect.runPromise(effect),
    });
    const dispatcher = yield* makeAutomationTurnDispatcher().pipe(
      Effect.provideService(ServerConfig, config),
      Effect.provideService(Crypto.Crypto, crypto),
      Effect.provideService(OrchestrationEngineService, engine),
    );
    const leaseOwner = `runner-${yield* crypto.randomUUIDv4}`;

    const runner = makeAutomationRunner({
      repository,
      dispatcher,
      leaseOwner,
      ...options?.runnerOptions,
    });

    // Whether the loop is actually running is not obvious from the outside:
    // the work is parked until the server activates, and a healthy tick that
    // finds nothing is silent by design. One info line on the first completed
    // tick is the difference between "scheduled work is alive" and "the
    // scheduler logged that it started and then never ran".
    const firstTickLogged = yield* Ref.make(false);

    const webhookContext = (delivery: {
      readonly id: string;
      readonly deliveryKey: string;
      readonly contentType: string | null;
      readonly body: string;
    }): Readonly<Record<string, unknown>> => {
      let payload: unknown = delivery.body;
      if (delivery.contentType?.toLowerCase().includes("json")) {
        try {
          payload = JSON.parse(delivery.body) as unknown;
        } catch {
          // Preserve malformed JSON as text; admission is transport-level and
          // should not silently discard a signed delivery.
        }
      }
      return {
        deliveryId: delivery.id,
        deliveryKey: delivery.deliveryKey,
        contentType: delivery.contentType,
        payload,
      };
    };

    const processWebhookQueue = Effect.gen(function* () {
      const deliveries = yield* webhooks
        .claimPending({
          leaseOwner,
          leaseMs: 60_000,
          limit: 10,
        })
        .pipe(
          Effect.catch((error) =>
            Effect.logWarning("automation.webhook.queue-scan-failed", { error }).pipe(
              Effect.as([] as const),
            ),
          ),
        );
      for (const delivery of deliveries) {
        const item = yield* Effect.promise(() =>
          Promise.resolve(
            repository.get({
              organizationId: LOCAL_ORGANIZATION_ID,
              ownerMemberId: LOCAL_OWNER_MEMBER_ID,
              automationId: delivery.automationId,
            }),
          ),
        ).pipe(Effect.orElseSucceed(() => null));
        if (!item || item.automation.state !== "active") {
          yield* webhooks
            .markDispatched({
              deliveryId: delivery.id,
              leaseOwner,
              runId: null,
              errorMessage: item ? "The linked automation is inactive." : "Automation not found.",
            })
            .pipe(Effect.ignore);
          continue;
        }

        const result = yield* runner.triggerOnce(item, {
          trigger: "webhook",
          // Delivery ids are only unique within one webhook/source. Include
          // the webhook id so two integrations feeding the same automation do
          // not accidentally deduplicate each other.
          nonce: `${delivery.webhookId}:${delivery.deliveryKey}`,
          context: webhookContext(delivery),
        });
        yield* webhooks
          .markDispatched({
            deliveryId: delivery.id,
            leaseOwner,
            runId: result.kind === "claimed" ? result.dispatched.runId : result.runId,
          })
          .pipe(Effect.ignore);
      }
    });

    const start: AutomationSchedulerShape["start"] = () =>
      Effect.gen(function* () {
        yield* forkParked(
          runner.tickOnce.pipe(
            // A tick that finds nothing is the normal case and stays at debug;
            // anything it actually did is worth a line, because an automation
            // running unattended is invisible otherwise.
            Effect.tap((report) =>
              Effect.gen(function* () {
                if (report.claimed > 0 || report.recovered > 0) {
                  yield* Effect.logInfo("automation.scheduler.tick", report);
                  return;
                }
                if (!(yield* Ref.getAndSet(firstTickLogged, true))) {
                  yield* Effect.logInfo("automation.scheduler.first-tick", report);
                  return;
                }
                yield* Effect.logDebug("automation.scheduler.tick", report);
              }),
            ),
            // A tick that throws must not take the loop down with it: the next
            // one may find the same work and succeed.
            Effect.catchCause((cause) =>
              Effect.logWarning("automation.scheduler.tick-failed", { cause }),
            ),
            Effect.repeat(Schedule.spaced(Duration.millis(tickIntervalMs))),
          ),
        );
        yield* forkParked(
          processWebhookQueue.pipe(
            Effect.catchCause((cause) =>
              Effect.logWarning("automation.webhook.queue-failed", { cause }),
            ),
            Effect.repeat(Schedule.spaced(Duration.seconds(1))),
          ),
        );
        yield* Effect.logInfo("automation.scheduler.started", { tickIntervalMs, leaseOwner });
      });

    return { start } satisfies AutomationSchedulerShape;
  });

export const makeAutomationSchedulerLive = (options?: AutomationSchedulerLiveOptions) =>
  Layer.effect(AutomationScheduler, makeAutomationScheduler(options));

export const AutomationSchedulerLive = makeAutomationSchedulerLive();
