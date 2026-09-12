// FILE: automations.ts
// Purpose: Wire contracts for automations - scheduled threads that run without
//          anyone opening them.
// Layer: Shared contracts (schema-only)
//
// The engine that owns schedules, revisions, and claims is vendored at
// `@modesto/openwork-automations` and is zod-based. These schemas are
// deliberately a separate, narrower Effect Schema surface rather than a
// re-export of upstream's types: the wire only needs what a client can create
// and display, and coupling the protocol to upstream's internal shapes would
// make every upstream change a protocol change.
//
// Timestamps are epoch milliseconds here, not ISO strings, because that is
// what the engine stores and converting at the boundary twice would invite
// drift between what the scheduler compares and what the UI shows.

import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString } from "./baseSchemas.ts";

export const AutomationScheduleTimezone = TrimmedNonEmptyString.check(Schema.isMaxLength(80));

/**
 * The three schedule shapes upstream's engine supports. `once` is the simplest
 * useful thing (run this tomorrow morning); `daily` and `weekly` are what a
 * recurring digest needs. Anything richer (cron) is not in the engine.
 */
export const AutomationSchedule = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("once"),
    timezone: AutomationScheduleTimezone,
    at: Schema.Number,
  }),
  Schema.Struct({
    kind: Schema.Literal("daily"),
    timezone: AutomationScheduleTimezone,
    hour: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 23 })),
    minute: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 59 })),
  }),
  Schema.Struct({
    kind: Schema.Literal("weekly"),
    timezone: AutomationScheduleTimezone,
    daysOfWeek: Schema.Array(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 6 }))).check(
      Schema.isMinLength(1),
      Schema.isMaxLength(7),
    ),
    hour: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 23 })),
    minute: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 59 })),
  }),
]);
export type AutomationSchedule = typeof AutomationSchedule.Type;

export const AutomationModelRef = Schema.Struct({
  /** A provider instance id; automations route the same way the composer does. */
  providerId: TrimmedNonEmptyString,
  modelId: TrimmedNonEmptyString,
  variant: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
});
export type AutomationModelRef = typeof AutomationModelRef.Type;

export const AutomationRunStatus = Schema.Literals([
  "queued",
  "claimed",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "skipped",
]);
export type AutomationRunStatus = typeof AutomationRunStatus.Type;

export const AutomationState = Schema.Literals([
  "active",
  "inactive",
  "needs_attention",
  "archived",
]);
export type AutomationState = typeof AutomationState.Type;

export const AutomationRunSummary = Schema.Struct({
  id: TrimmedNonEmptyString,
  status: AutomationRunStatus,
  trigger: Schema.Literals(["scheduled", "recovery", "manual", "webhook"]),
  scheduledFor: Schema.NullOr(Schema.Number),
  startedAt: Schema.NullOr(Schema.Number),
  finishedAt: Schema.NullOr(Schema.Number),
  resultSummary: Schema.NullOr(Schema.String),
  errorMessage: Schema.NullOr(Schema.String),
});
export type AutomationRunSummary = typeof AutomationRunSummary.Type;

export const AutomationSummary = Schema.Struct({
  id: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  state: AutomationState,
  instructions: Schema.String,
  schedule: AutomationSchedule,
  model: AutomationModelRef,
  nextDueAt: Schema.NullOr(Schema.Number),
  latestRunAt: Schema.NullOr(Schema.Number),
  latestRun: Schema.NullOr(AutomationRunSummary),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
});
export type AutomationSummary = typeof AutomationSummary.Type;

export const AutomationListInput = Schema.Struct({});
export type AutomationListInput = typeof AutomationListInput.Type;

export const AutomationListResult = Schema.Struct({
  automations: Schema.Array(AutomationSummary),
});
export type AutomationListResult = typeof AutomationListResult.Type;

const AUTOMATION_INSTRUCTIONS_MAX = 100_000;

export const AutomationCreateInput = Schema.Struct({
  name: TrimmedNonEmptyString.check(Schema.isMaxLength(120)),
  instructions: TrimmedNonEmptyString.check(Schema.isMaxLength(AUTOMATION_INSTRUCTIONS_MAX)),
  schedule: AutomationSchedule,
  model: AutomationModelRef,
});
export type AutomationCreateInput = typeof AutomationCreateInput.Type;

export const AutomationCreateResult = Schema.Struct({
  automation: AutomationSummary,
});
export type AutomationCreateResult = typeof AutomationCreateResult.Type;

export const AutomationSetStateInput = Schema.Struct({
  automationId: TrimmedNonEmptyString,
  // `needs_attention` is set by the runner, never requested by a client.
  state: Schema.Literals(["active", "inactive", "archived"]),
});
export type AutomationSetStateInput = typeof AutomationSetStateInput.Type;

export const AutomationSetStateResult = Schema.Struct({
  automation: Schema.NullOr(AutomationSummary),
});
export type AutomationSetStateResult = typeof AutomationSetStateResult.Type;

export const AutomationRunsInput = Schema.Struct({
  automationId: TrimmedNonEmptyString,
  limit: Schema.optional(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 }))),
});
export type AutomationRunsInput = typeof AutomationRunsInput.Type;

export const AutomationRunsResult = Schema.Struct({
  runs: Schema.Array(AutomationRunSummary),
});
export type AutomationRunsResult = typeof AutomationRunsResult.Type;

export class AutomationRequestError extends Schema.ErrorClass<AutomationRequestError>(
  "AutomationRequestError",
)({
  _tag: Schema.tag("AutomationRequestError"),
  code: Schema.Literals(["not_found", "invalid_request", "storage_failed"]),
  message: TrimmedNonEmptyString,
}) {}
