// FILE: customModelEndpointsOpenCode.ts
// Purpose: Resolve Settings > Providers > Custom endpoints into the
//          `OPENCODE_CONFIG_CONTENT` / `KILO_CONFIG_CONTENT` values the
//          OpenCode-compatible runtimes read at spawn time.
//
//          Split out of `customModelEndpoints.ts` (which stays pure and
//          dependency-free so it can be unit-tested and imported from the web
//          client) because this half needs the two server services that hold
//          the definitions and their API keys: `ServerSettingsService` and
//          `ServerSecretStore`.
//
//          Spawn-time only, exactly like the Codex side's `-c` args: the
//          value is baked into the driver's process environment when the
//          provider instance is built, so editing an endpoint applies on the
//          next instance rebuild rather than to an already-running
//          OpenCode/Kilo server.
// @module provider/customModelEndpointsOpenCode

import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import { ServerSettingsService } from "../serverSettings.ts";
import {
  buildOpenCodeCustomProviderConfig,
  customModelEndpointSecretName,
  mergeOpenCodeCustomProviderConfig,
} from "./customModelEndpoints.ts";

const OPENCODE_CONFIG_CONTENT_ENV = "OPENCODE_CONFIG_CONTENT";
const KILO_CONFIG_CONTENT_ENV = "KILO_CONFIG_CONTENT";
const EMPTY_CONFIG_CONTENT = "{}";

/**
 * Returns the environment with both OpenCode-compatible config-content vars
 * rewritten to include the configured custom endpoints, merged on top of
 * whatever the caller/user already had there.
 *
 * Both var names are always set for the same reason `opencodeRuntime.ts` sets
 * both: this code is binary-agnostic, and only the one the spawned binary
 * actually reads has any effect.
 *
 * Never fails: a settings or secret-store read that errors degrades to
 * "no custom endpoints", which leaves the environment exactly as it was. A
 * misconfigured router must not stop OpenCode from starting at all.
 */
export const resolveOpenCodeCompatibleCustomProviderEnv = Effect.fn(
  "resolveOpenCodeCompatibleCustomProviderEnv",
)(function* (environment: NodeJS.ProcessEnv) {
  const serverSettings = yield* ServerSettingsService;
  const secretStore = yield* ServerSecretStore.ServerSecretStore;

  const settings = yield* serverSettings.getSettings.pipe(
    Effect.catchCause(() => Effect.succeed(undefined)),
  );
  const endpoints = settings?.customModelEndpoints ?? [];
  if (endpoints.length === 0) {
    return environment;
  }

  const apiKeyEntries = yield* Effect.forEach(
    endpoints,
    (endpoint) =>
      secretStore.get(customModelEndpointSecretName(endpoint.id)).pipe(
        Effect.map((bytes) =>
          Option.isSome(bytes) && bytes.value.length > 0
            ? ([endpoint.id, new TextDecoder().decode(bytes.value)] as const)
            : null,
        ),
        Effect.orElseSucceed(() => null),
      ),
    { concurrency: "unbounded" },
  );
  const apiKeyByEndpointId = new Map(
    apiKeyEntries.filter((entry): entry is readonly [string, string] => entry !== null),
  );

  const customProviderConfig = buildOpenCodeCustomProviderConfig(endpoints, apiKeyByEndpointId);
  if (!customProviderConfig) {
    return environment;
  }

  return {
    ...environment,
    [OPENCODE_CONFIG_CONTENT_ENV]: mergeOpenCodeCustomProviderConfig(
      environment[OPENCODE_CONFIG_CONTENT_ENV] ?? EMPTY_CONFIG_CONTENT,
      customProviderConfig,
    ),
    [KILO_CONFIG_CONTENT_ENV]: mergeOpenCodeCustomProviderConfig(
      environment[KILO_CONFIG_CONTENT_ENV] ?? EMPTY_CONFIG_CONTENT,
      customProviderConfig,
    ),
  } satisfies NodeJS.ProcessEnv;
});
