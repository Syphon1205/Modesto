// FILE: CustomAcpSupport.ts
// Purpose: Spawn/auth glue between the generic AcpSessionRuntime and an
//          arbitrary, user-configured ACP-speaking agent - the "Custom ACP
//          Agent" driver. Unlike every other provider ported into this tree
//          (Cursor, Grok, GitHub Copilot, ...), there is no fixed identity
//          here: the binary, its args, and its real ACP auth method id (if
//          any) are whatever the user typed into this instance's settings,
//          because Modesto has no built-in integration for whatever agent
//          they're pointing at.
//
// Consequences of that, all deliberate:
// - `args` is passed to the child process exactly as configured, verbatim -
//   no implicit `--acp` or similar is appended, since different real ACP
//   agents use different flags (or none) to enter ACP mode. The user is
//   responsible for getting this right, the same way Zed's own "custom
//   agent" server config works (raw command + args, no magic).
// - `authMethodId` is optional. Passing an empty/unset value skips the
//   `authenticate` RPC call entirely (see AcpSessionRuntime.ts's additive
//   `authMethodId: string | undefined` support, added for this driver) -
//   many real ACP agents may not need a separate authenticate step at all,
//   and this tree has no way to discover a correct method id automatically
//   for an agent it doesn't know ahead of time.
// - No model flag is ever constructed. If the user's custom agent takes a
//   `--model` (or similar) flag, they can bake it directly into `args`.
//
// @module provider/acp/CustomAcpSupport
import { type CustomAcpSettings } from "@modesto/contracts";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import type * as EffectAcpErrors from "effect-acp/errors";

import * as AcpSessionRuntime from "./AcpSessionRuntime.ts";

type CustomAcpRuntimeSettings = Pick<CustomAcpSettings, "command" | "args" | "authMethodId">;

export interface CustomAcpRuntimeInput extends Omit<
  AcpSessionRuntime.AcpSessionRuntimeOptions,
  "authMethodId" | "clientCapabilities" | "spawn"
> {
  readonly childProcessSpawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
  readonly customAcpSettings: CustomAcpRuntimeSettings | null | undefined;
  readonly environment?: NodeJS.ProcessEnv;
}

export function buildCustomAcpSpawnInput(
  customAcpSettings: CustomAcpRuntimeSettings | null | undefined,
  cwd: string,
  environment?: NodeJS.ProcessEnv,
): AcpSessionRuntime.AcpSpawnInput {
  return {
    command: customAcpSettings?.command?.trim() ?? "",
    args: customAcpSettings?.args ?? [],
    cwd,
    ...(environment ? { env: environment } : {}),
  };
}

export const makeCustomAcpRuntime = (
  input: CustomAcpRuntimeInput,
): Effect.Effect<
  AcpSessionRuntime.AcpSessionRuntime["Service"],
  EffectAcpErrors.AcpError,
  Crypto.Crypto | Scope.Scope
> =>
  Effect.gen(function* () {
    const acpContext = yield* Layer.build(
      AcpSessionRuntime.layer({
        ...input,
        spawn: buildCustomAcpSpawnInput(input.customAcpSettings, input.cwd, input.environment),
        authMethodId: input.customAcpSettings?.authMethodId?.trim() || undefined,
        clientCapabilities: {
          // Advertises that this client can answer a form elicitation - the
          // adapter registers `handleElicitation` and renders it in the
          // composer's question picker. `url` mode is deliberately not claimed:
          // it asks the client to send the user to a browser, which the picker
          // cannot represent, so the handler declines it.
          elicitation: { form: {} },
        },
      }).pipe(
        Layer.provide(
          Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, input.childProcessSpawner),
        ),
      ),
    );
    return yield* Effect.service(AcpSessionRuntime.AcpSessionRuntime).pipe(
      Effect.provide(acpContext),
    );
  });
