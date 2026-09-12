import type { ServerAuthDescriptor } from "@modesto/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ServerConfig from "../config.ts";
import { isRemoteReachableHost, resolveSessionCookieName } from "./utils.ts";

export class EnvironmentAuthPolicy extends Context.Service<
  EnvironmentAuthPolicy,
  {
    readonly getDescriptor: () => Effect.Effect<ServerAuthDescriptor>;
    /**
     * Whether this environment will hand a session to a same-machine browser
     * with no credential. True only when the server is bound to loopback, so
     * reaching it already means being on the machine.
     */
    readonly allowsLoopbackBootstrap: boolean;
  }
>()("t3/auth/EnvironmentAuthPolicy") {}

export const make = Effect.gen(function* () {
  const config = yield* ServerConfig.ServerConfig;
  const isRemoteReachable = isRemoteReachableHost(config.host);

  const policy =
    config.mode === "desktop"
      ? isRemoteReachable
        ? "remote-reachable"
        : "desktop-managed-local"
      : isRemoteReachable
        ? "remote-reachable"
        : "loopback-browser";

  // A loopback-only server is reachable by exactly the processes that already
  // run as this user, so a second browser window is not a new trust decision -
  // it should open, not ask for a token. Remote-reachable hosts keep pairing.
  const allowsLoopbackBootstrap = policy === "loopback-browser";

  const bootstrapMethods: ServerAuthDescriptor["bootstrapMethods"] =
    policy === "desktop-managed-local"
      ? ["desktop-bootstrap"]
      : config.mode === "desktop" && policy === "remote-reachable"
        ? ["desktop-bootstrap", "one-time-token"]
        : allowsLoopbackBootstrap
          ? ["loopback-bootstrap", "one-time-token"]
          : ["one-time-token"];

  const descriptor: ServerAuthDescriptor = {
    policy,
    bootstrapMethods,
    sessionMethods: ["browser-session-cookie", "bearer-access-token", "dpop-access-token"],
    sessionCookieName: resolveSessionCookieName({
      mode: config.mode,
      port: config.port,
      host: config.host,
      instanceKey: config.stateDir,
      development: config.devUrl !== undefined,
    }),
  };

  return EnvironmentAuthPolicy.of({
    allowsLoopbackBootstrap,
    getDescriptor: () =>
      Effect.succeed(descriptor).pipe(Effect.withSpan("EnvironmentAuthPolicy.getDescriptor")),
  });
});

export const layer = Layer.effect(EnvironmentAuthPolicy, make);
