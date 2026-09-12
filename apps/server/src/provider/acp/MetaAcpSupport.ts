// FILE: MetaAcpSupport.ts
// Purpose: Spawn/auth/model glue between the generic AcpSessionRuntime and
//          Muse Code (`muse --acp`). Muse Code is Meta's coding agent; its
//          models are Muse Spark on Meta Model API. Auth is external
//          (`muse login`, `META_API_KEY`, or `MODEL_API_KEY`) so this
//          adapter never calls ACP `authenticate`.
//
//          When Muse Code speaks ACP, sessions reuse the same
//          AcpSessionRuntime as Gemini/Grok/Copilot. If `--acp` is missing
//          on an older CLI, the health probe still reports the Spark catalog
//          and Settings can point Binary path at an ACP adapter such as
//          `muse-acp`.
//
// @module provider/acp/MetaAcpSupport
import { type MetaSettings } from "@modesto/contracts";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import * as EffectAcpErrors from "effect-acp/errors";
import type * as EffectAcpSchema from "effect-acp/schema";

import * as AcpSessionRuntime from "./AcpSessionRuntime.ts";

type MetaAcpRuntimeSettings = Pick<MetaSettings, "binaryPath">;

export interface MetaAcpRuntimeInput extends Omit<
  AcpSessionRuntime.AcpSessionRuntimeOptions,
  "authMethodId" | "clientCapabilities" | "spawn"
> {
  readonly childProcessSpawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
  readonly metaSettings: MetaAcpRuntimeSettings | null | undefined;
  readonly environment?: NodeJS.ProcessEnv;
}

export function buildMetaAcpSpawnInput(
  metaSettings: MetaAcpRuntimeSettings | null | undefined,
  cwd: string,
  environment?: NodeJS.ProcessEnv,
): AcpSessionRuntime.AcpSpawnInput {
  return {
    command: metaSettings?.binaryPath || "muse",
    args: ["--acp"],
    cwd,
    ...(environment ? { env: environment } : {}),
  };
}

export const makeMetaAcpRuntime = (
  input: MetaAcpRuntimeInput,
): Effect.Effect<
  AcpSessionRuntime.AcpSessionRuntime["Service"],
  EffectAcpErrors.AcpError,
  Crypto.Crypto | Scope.Scope
> =>
  Effect.gen(function* () {
    const acpContext = yield* Layer.build(
      AcpSessionRuntime.layer({
        ...input,
        spawn: buildMetaAcpSpawnInput(input.metaSettings, input.cwd, input.environment),
        authMethodId: undefined,
        clientCapabilities: {
          auth: { terminal: false },
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

export function resolveMetaAcpModelId(model: string | null | undefined): string | undefined {
  const trimmed = model?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function currentMetaModelIdFromSessionSetup(
  sessionSetupResult:
    | EffectAcpSchema.LoadSessionResponse
    | EffectAcpSchema.NewSessionResponse
    | EffectAcpSchema.ResumeSessionResponse,
): string | undefined {
  return sessionSetupResult.models?.currentModelId?.trim() || undefined;
}

export function applyMetaAcpModelSelection<E>(input: {
  readonly runtime: Pick<AcpSessionRuntime.AcpSessionRuntime["Service"], "setSessionModel">;
  readonly currentModelId: string | undefined;
  readonly requestedModelId: string | undefined;
  readonly mapError: (cause: EffectAcpErrors.AcpError) => E;
}): Effect.Effect<string | undefined, E> {
  const shouldSwitchModel =
    input.requestedModelId !== undefined && input.requestedModelId !== input.currentModelId;
  if (!shouldSwitchModel) {
    return Effect.succeed(input.currentModelId);
  }
  return input.runtime
    .setSessionModel(input.requestedModelId)
    .pipe(Effect.mapError(input.mapError), Effect.as(input.requestedModelId));
}
