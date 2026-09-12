// FILE: AutomationService.ts
// Purpose: What the RPC layer talks to - list, create, enable/disable, and read
//          the runs of an automation.
// Layer: Server automation
//
// Sits between the wire contracts (`@modesto/contracts/automations`) and the
// vendored engine's repository. Two jobs, both boundary work:
//
//  1. **Tenancy.** Upstream's engine is multi-tenant (organization + owner
//     member) because it came from a hosted product. Modesto is a local
//     single-user app, so every call uses the same constants. They are not
//     "unused fields": the repository's uniqueness and isolation rules are
//     written in terms of them, and its conformance suite tests them.
//  2. **Shape.** The engine's zod types are internal; the wire carries a
//     narrower summary. Converting here keeps an upstream change from becoming
//     a protocol change.

import type {
  AutomationCreateInput,
  AutomationListResult,
  AutomationRunSummary,
  AutomationRunsInput,
  AutomationSetStateInput,
  AutomationSummary,
} from "@modesto/contracts";
import { AutomationRequestError } from "@modesto/contracts";
import type {
  AutomationListItem,
  AutomationRepository,
  AutomationRun,
} from "@modesto/openwork-automations";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { createSqliteAutomationRepository } from "./SqliteAutomationRepository.ts";

/**
 * Local tenancy. One user, one "organization" - see the module header for why
 * these exist at all rather than being dropped from the calls.
 */
export const LOCAL_ORGANIZATION_ID = "org_local";
export const LOCAL_OWNER_MEMBER_ID = "member_local";

const DEFAULT_RUN_LIMIT = 20;

export interface AutomationServiceShape {
  readonly list: () => Effect.Effect<AutomationListResult, AutomationRequestError>;
  readonly create: (
    input: AutomationCreateInput,
  ) => Effect.Effect<AutomationSummary, AutomationRequestError>;
  readonly setState: (
    input: AutomationSetStateInput,
  ) => Effect.Effect<AutomationSummary | null, AutomationRequestError>;
  readonly runs: (
    input: AutomationRunsInput,
  ) => Effect.Effect<ReadonlyArray<AutomationRunSummary>, AutomationRequestError>;
}

export class AutomationService extends Context.Service<AutomationService, AutomationServiceShape>()(
  "t3/automation/AutomationService",
) {}

function toRunSummary(run: AutomationRun): AutomationRunSummary {
  return {
    id: run.id,
    status: run.status,
    trigger: run.trigger,
    scheduledFor: run.scheduledFor,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    resultSummary: run.resultSummary,
    errorMessage: run.error?.message ?? null,
  };
}

function toSummary(item: AutomationListItem): AutomationSummary {
  return {
    id: item.automation.id,
    name: item.automation.name,
    state: item.automation.state,
    instructions: item.revision.instructions,
    schedule: item.revision.schedule,
    model: {
      providerId: item.revision.model.providerId,
      modelId: item.revision.model.modelId,
      variant: item.revision.model.variant ?? null,
    },
    nextDueAt: item.automation.nextDueAt,
    latestRunAt: item.automation.latestRunAt,
    latestRun: item.latestRun ? toRunSummary(item.latestRun) : null,
    createdAt: item.automation.createdAt,
    updatedAt: item.automation.updatedAt,
  };
}

/**
 * The repository is Promise-based (upstream's port), and its failures are
 * thrown rejections rather than typed errors. Everything crossing into Effect
 * lands as one `storage_failed` so the RPC layer has a real error to report
 * instead of a defect that kills the connection.
 */
const attempt = <A>(operation: string, thunk: () => Promise<A> | A) =>
  Effect.tryPromise({
    try: async () => await thunk(),
    catch: (cause) =>
      new AutomationRequestError({
        code: "storage_failed",
        message: `Automation ${operation} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      }),
  });

export function makeAutomationService(repository: AutomationRepository): AutomationServiceShape {
  const tenancy = {
    organizationId: LOCAL_ORGANIZATION_ID,
    ownerMemberId: LOCAL_OWNER_MEMBER_ID,
  } as const;

  return {
    list: () =>
      attempt("list", () => repository.list({ ...tenancy, limit: 200 })).pipe(
        Effect.map((page) => ({
          automations: page.items
            .filter((item) => item.automation.state !== "archived")
            .map(toSummary),
        })),
      ),

    create: (input) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const created = yield* attempt("create", () =>
          repository.create({
            ...tenancy,
            definition: {
              name: input.name,
              instructions: input.instructions,
              // The wire schema is readonly; upstream's zod schema wants a
              // mutable array and copies it on parse anyway.
              schedule:
                input.schedule.kind === "weekly"
                  ? { ...input.schedule, daysOfWeek: [...input.schedule.daysOfWeek] }
                  : input.schedule,
              model: {
                providerId: input.model.providerId,
                modelId: input.model.modelId,
                ...(input.model.variant ? { variant: input.model.variant } : {}),
              },
            },
            now,
          }),
        );
        return toSummary(created);
      }),

    setState: (input) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const updated = yield* attempt("state change", () =>
          repository.setState({
            ...tenancy,
            automationId: input.automationId,
            state: input.state,
            now,
          }),
        );
        return updated === null ? null : toSummary(updated);
      }),

    runs: (input) =>
      attempt("run history", () =>
        repository.listRuns({
          ...tenancy,
          automationId: input.automationId,
          limit: input.limit ?? DEFAULT_RUN_LIMIT,
        }),
      ).pipe(Effect.map((page) => page.items.map(toRunSummary))),
  };
}

export const AutomationServiceLive = Layer.effect(
  AutomationService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return makeAutomationService(
      createSqliteAutomationRepository({ sql, run: (effect) => Effect.runPromise(effect) }),
    );
  }),
);
