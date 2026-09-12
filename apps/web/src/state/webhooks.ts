import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@modesto/client-runtime/state/runtime";
import { WS_METHODS } from "@modesto/contracts";
import * as Effect from "effect/Effect";

import { connectionAtomRuntime } from "../connection/runtime";

export const webhookList = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:webhooks:list",
  tag: WS_METHODS.webhookList,
  staleTimeMs: 1_000,
  idleTtlMs: 60_000,
});

export const webhookCreate = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:webhooks:create",
  tag: WS_METHODS.webhookCreate,
  onSettled: (target, registry) =>
    Effect.sync(() =>
      registry.refresh(webhookList({ environmentId: target.environmentId, input: {} })),
    ),
});

export const webhookSetEnabled = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:webhooks:set-enabled",
  tag: WS_METHODS.webhookSetEnabled,
  onSettled: (target, registry) =>
    Effect.sync(() =>
      registry.refresh(webhookList({ environmentId: target.environmentId, input: {} })),
    ),
});

export const webhookDelete = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:webhooks:delete",
  tag: WS_METHODS.webhookDelete,
  onSettled: (target, registry) =>
    Effect.sync(() =>
      registry.refresh(webhookList({ environmentId: target.environmentId, input: {} })),
    ),
});
