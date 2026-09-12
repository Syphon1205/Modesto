/**
 * Automations - scheduled threads that run without anyone opening them.
 *
 * The server owns everything that matters here (schedules, claims, leases, the
 * runner); these are the four calls the surface needs. See
 * `apps/server/src/automation/` for the engine side.
 */
import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@modesto/client-runtime/state/runtime";
import { WS_METHODS } from "@modesto/contracts";
import * as Effect from "effect/Effect";

import { connectionAtomRuntime } from "../connection/runtime";

export const automationList = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:automations:list",
  tag: WS_METHODS.automationList,
  // Runs settle in the background, so the list goes stale on its own rather
  // than only when the user acts.
  staleTimeMs: 5_000,
  idleTtlMs: 60_000,
});

export const automationRuns = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:automations:runs",
  tag: WS_METHODS.automationRuns,
  staleTimeMs: 5_000,
  idleTtlMs: 60_000,
});

export const automationCreate = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:automations:create",
  tag: WS_METHODS.automationCreate,
  onSettled: (target, registry) =>
    Effect.sync(() =>
      registry.refresh(automationList({ environmentId: target.environmentId, input: {} })),
    ),
});

export const automationSetState = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:automations:set-state",
  tag: WS_METHODS.automationSetState,
  onSettled: (target, registry) =>
    Effect.sync(() =>
      registry.refresh(automationList({ environmentId: target.environmentId, input: {} })),
    ),
});
