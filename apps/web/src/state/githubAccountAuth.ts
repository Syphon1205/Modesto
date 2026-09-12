/**
 * The app's own "sign in with GitHub" identity flow (via the server's
 * gh-CLI-backed RPC methods), distinct from the source-control PR
 * integration elsewhere in state/. See apps/server/src/git/githubAccountAuth.ts
 * for the server-side implementation and protocol notes.
 */
import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@modesto/client-runtime/state/runtime";
import { WS_METHODS } from "@modesto/contracts";
import * as Effect from "effect/Effect";

import { connectionAtomRuntime } from "../connection/runtime";

export const githubAuthStatus = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:git:github-auth-status",
  tag: WS_METHODS.gitGithubAuthStatus,
  staleTimeMs: 2_000,
  idleTtlMs: 60_000,
});

export const githubSignIn = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:git:github-sign-in",
  tag: WS_METHODS.gitGithubSignIn,
  onSettled: (target, registry) =>
    Effect.sync(() =>
      registry.refresh(githubAuthStatus({ environmentId: target.environmentId, input: {} })),
    ),
});

export const githubSignOut = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:git:github-sign-out",
  tag: WS_METHODS.gitGithubSignOut,
  onSettled: (target, registry) =>
    Effect.sync(() =>
      registry.refresh(githubAuthStatus({ environmentId: target.environmentId, input: {} })),
    ),
});
