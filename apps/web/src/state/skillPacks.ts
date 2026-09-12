import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@modesto/client-runtime/state/runtime";
import { WS_METHODS } from "@modesto/contracts";
import * as Effect from "effect/Effect";

import { connectionAtomRuntime } from "../connection/runtime";

export const skillPackList = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:skill-packs:list",
  tag: WS_METHODS.skillPackList,
  staleTimeMs: 2_000,
  idleTtlMs: 60_000,
});

export const skillPackPreview = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:skill-packs:preview",
  tag: WS_METHODS.skillPackPreview,
});

export const skillPackInstall = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:skill-packs:install",
  tag: WS_METHODS.skillPackInstall,
  onSettled: (target, registry) =>
    Effect.sync(() =>
      registry.refresh(skillPackList({ environmentId: target.environmentId, input: {} })),
    ),
});

export const skillPackUninstall = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:skill-packs:uninstall",
  tag: WS_METHODS.skillPackUninstall,
  onSettled: (target, registry) =>
    Effect.sync(() =>
      registry.refresh(skillPackList({ environmentId: target.environmentId, input: {} })),
    ),
});
