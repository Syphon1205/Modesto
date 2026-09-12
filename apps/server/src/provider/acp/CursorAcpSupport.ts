import { type ProviderOptionSelection } from "@modesto/contracts";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import type * as EffectAcpErrors from "effect-acp/errors";

import {
  CURSOR_PARAMETERIZED_MODEL_PICKER_CAPABILITIES,
  resolveCursorAcpBaseModelId,
  resolveCursorAcpConfigUpdates,
} from "../Layers/CursorProvider.ts";
import {
  CURSOR_FAMILY_DESCRIPTOR,
  resolveCursorFamilyBinaryPath,
  type CursorFamilyDescriptor,
} from "../cursorFamily.ts";
import * as AcpSessionRuntime from "./AcpSessionRuntime.ts";

/**
 * The slice of a cursor-family instance's settings that spawning depends on.
 * `apiEndpoint` is only ever set for Cursor itself (see
 * `CursorFamilyDescriptor.supportsApiEndpoint`).
 */
type CursorAcpRuntimeCursorSettings = {
  readonly binaryPath?: string | undefined;
  readonly apiEndpoint?: string | undefined;
};

export interface CursorAcpRuntimeInput extends Omit<
  AcpSessionRuntime.AcpSessionRuntimeOptions,
  "authMethodId" | "clientCapabilities" | "spawn"
> {
  readonly childProcessSpawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
  readonly cursorSettings: CursorAcpRuntimeCursorSettings | null | undefined;
  readonly environment?: NodeJS.ProcessEnv;
  /**
   * Which cursor-family agent to spawn. Defaults to Cursor itself, so every
   * pre-existing call site keeps its exact behavior.
   */
  readonly descriptor?: CursorFamilyDescriptor;
}

export interface CursorAcpModelSelectionErrorContext {
  readonly cause: EffectAcpErrors.AcpError;
  readonly step: "set-config-option" | "set-model";
  readonly configId?: string;
}

export function buildCursorAcpSpawnInput(
  cursorSettings: CursorAcpRuntimeCursorSettings | null | undefined,
  cwd: string,
  environment?: NodeJS.ProcessEnv,
  descriptor: CursorFamilyDescriptor = CURSOR_FAMILY_DESCRIPTOR,
): AcpSessionRuntime.AcpSpawnInput {
  const apiEndpoint = descriptor.supportsApiEndpoint ? cursorSettings?.apiEndpoint : undefined;
  return {
    command:
      descriptor === CURSOR_FAMILY_DESCRIPTOR
        ? // Cursor keeps its historical resolution (configured path or the
          // bare name, resolved by the spawner through PATH) so this
          // refactor cannot change how existing installs launch.
          cursorSettings?.binaryPath || descriptor.defaultBinary
        : resolveCursorFamilyBinaryPath(descriptor, cursorSettings?.binaryPath),
    args: [...(apiEndpoint ? (["-e", apiEndpoint] as const) : []), "acp"],
    cwd,
    ...(environment ? { env: environment } : {}),
  };
}

export const makeCursorAcpRuntime = (
  input: CursorAcpRuntimeInput,
): Effect.Effect<
  AcpSessionRuntime.AcpSessionRuntime["Service"],
  EffectAcpErrors.AcpError,
  Crypto.Crypto | Scope.Scope
> =>
  Effect.gen(function* () {
    const { descriptor: requestedDescriptor, ...runtimeInput } = input;
    const descriptor = requestedDescriptor ?? CURSOR_FAMILY_DESCRIPTOR;
    const acpContext = yield* Layer.build(
      AcpSessionRuntime.layer({
        ...runtimeInput,
        spawn: buildCursorAcpSpawnInput(
          input.cursorSettings,
          input.cwd,
          input.environment,
          descriptor,
        ),
        // `null` means "skip authenticate": Kimi, Qwen and Poolside all hold
        // their own login state in their CLI's own config, exactly as the
        // primary tree's delegating adapters do (they pass
        // `authMethodId: null` into the Cursor adapter).
        authMethodId: descriptor.authMethodId ?? undefined,
        clientCapabilities: CURSOR_PARAMETERIZED_MODEL_PICKER_CAPABILITIES,
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

interface CursorAcpModelSelectionRuntime {
  readonly getConfigOptions: AcpSessionRuntime.AcpSessionRuntime["Service"]["getConfigOptions"];
  readonly setConfigOption: (
    configId: string,
    value: string | boolean,
  ) => Effect.Effect<unknown, EffectAcpErrors.AcpError>;
  readonly setModel: (model: string) => Effect.Effect<unknown, EffectAcpErrors.AcpError>;
}

export function applyCursorAcpModelSelection<E>(input: {
  readonly runtime: CursorAcpModelSelectionRuntime;
  readonly model: string | null | undefined;
  readonly selections: ReadonlyArray<ProviderOptionSelection> | null | undefined;
  readonly mapError: (context: CursorAcpModelSelectionErrorContext) => E;
}): Effect.Effect<void, E> {
  return Effect.gen(function* () {
    yield* input.runtime.setModel(resolveCursorAcpBaseModelId(input.model)).pipe(
      Effect.mapError((cause) =>
        input.mapError({
          cause,
          step: "set-model",
        }),
      ),
    );

    const configUpdates = resolveCursorAcpConfigUpdates(
      yield* input.runtime.getConfigOptions,
      input.selections,
    );
    for (const update of configUpdates) {
      yield* input.runtime.setConfigOption(update.configId, update.value).pipe(
        Effect.mapError((cause) =>
          input.mapError({
            cause,
            step: "set-config-option",
            configId: update.configId,
          }),
        ),
      );
    }
  });
}
