import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@modesto/client-runtime/state/runtime";
import { WS_METHODS } from "@modesto/contracts";
import * as Effect from "effect/Effect";

import { connectionAtomRuntime } from "../connection/runtime";

export const vercelAuthStatus = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:vercel:auth-status",
  tag: WS_METHODS.vercelAuthStatus,
  staleTimeMs: 2_000,
  idleTtlMs: 60_000,
});

export const vercelListProjects = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:vercel:list-projects",
  tag: WS_METHODS.vercelListProjects,
  staleTimeMs: 8_000,
  idleTtlMs: 60_000,
});

export const vercelSetToken = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:vercel:set-token",
  tag: WS_METHODS.vercelSetToken,
  onSettled: (target, registry) =>
    Effect.sync(() => {
      registry.refresh(vercelAuthStatus({ environmentId: target.environmentId, input: {} }));
      registry.refresh(vercelListProjects({ environmentId: target.environmentId, input: {} }));
    }),
});

export const vercelClearToken = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:vercel:clear-token",
  tag: WS_METHODS.vercelClearToken,
  onSettled: (target, registry) =>
    Effect.sync(() => {
      registry.refresh(vercelAuthStatus({ environmentId: target.environmentId, input: {} }));
      registry.refresh(vercelListProjects({ environmentId: target.environmentId, input: {} }));
    }),
});

export const vercelInstallMcp = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:vercel:install-mcp",
  tag: WS_METHODS.vercelInstallMcp,
  onSettled: (target, registry) =>
    Effect.sync(() =>
      registry.refresh(vercelAuthStatus({ environmentId: target.environmentId, input: {} })),
    ),
});
