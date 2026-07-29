/**
 * PoolsideAdapterLive - Poolside Agent CLI (`pool acp`) via Modesto's shared ACP engine.
 *
 * Poolside remains a first-class provider while reusing the battle-tested ACP
 * transport used by Cursor for session lifecycle, permissions, resume, and events.
 *
 * @module PoolsideAdapterLive
 */
import {
  type ModelSelection,
  type ProviderListModelsResult,
  type ProviderRuntimeEvent,
  type ProviderSession,
  type ProviderSessionStartInput,
  type ProviderStartOptions,
} from "@modesto/contracts";
import { Effect, Layer, Stream } from "effect";

import { makeCursorAdapter, type CursorAdapterLiveOptions } from "./CursorAdapter.ts";
import {
  ProviderAdapterProcessError,
  ProviderAdapterRequestError,
  ProviderAdapterSessionClosedError,
  ProviderAdapterSessionNotFoundError,
  ProviderAdapterValidationError,
  type ProviderAdapterError,
} from "../Errors.ts";
import {
  PoolsideAdapter,
  type PoolsideAdapterShape,
} from "../Services/PoolsideAdapter.ts";

const PROVIDER = "poolside" as const;
const DELEGATE_PROVIDER = "cursor" as const;

function toCursorModelSelection(
  selection: ModelSelection | undefined,
): ModelSelection | undefined {
  if (selection?.provider !== PROVIDER || selection.model === "default") {
    return undefined;
  }
  return {
    provider: DELEGATE_PROVIDER,
    model: selection.model,
    options: {
      ...(selection.options?.reasoningEffort
        ? { reasoningEffort: selection.options.reasoningEffort }
        : {}),
    },
  };
}

function toCursorProviderOptions(
  options: ProviderStartOptions | undefined,
): ProviderStartOptions | undefined {
  const binaryPath = options?.poolside?.binaryPath;
  return binaryPath
    ? {
        cursor: { binaryPath },
      }
    : undefined;
}

function toCursorStartInput(input: ProviderSessionStartInput): ProviderSessionStartInput {
  const modelSelection = toCursorModelSelection(input.modelSelection);
  const providerOptions = toCursorProviderOptions(input.providerOptions);
  const {
    modelSelection: _poolsideModelSelection,
    providerOptions: _poolsideProviderOptions,
    ...sharedInput
  } = input;
  return {
    ...sharedInput,
    provider: DELEGATE_PROVIDER,
    ...(modelSelection ? { modelSelection } : {}),
    ...(providerOptions ? { providerOptions } : {}),
  };
}

function toPoolsideSession(session: ProviderSession): ProviderSession {
  return {
    ...session,
    provider: PROVIDER,
  };
}

function toPoolsideEvent(event: ProviderRuntimeEvent): ProviderRuntimeEvent {
  return {
    ...event,
    provider: PROVIDER,
  } as ProviderRuntimeEvent;
}

function toPoolsideModels(result: ProviderListModelsResult): ProviderListModelsResult {
  return {
    ...result,
    source: result.source?.replace(/^cursor/u, "poolside") ?? "poolside.acp",
  };
}

function toPoolsideError(error: ProviderAdapterError): ProviderAdapterError {
  switch (error._tag) {
    case "ProviderAdapterValidationError":
      return new ProviderAdapterValidationError({
        ...error,
        provider: PROVIDER,
      });
    case "ProviderAdapterSessionNotFoundError":
      return new ProviderAdapterSessionNotFoundError({
        ...error,
        provider: PROVIDER,
      });
    case "ProviderAdapterSessionClosedError":
      return new ProviderAdapterSessionClosedError({
        ...error,
        provider: PROVIDER,
      });
    case "ProviderAdapterRequestError":
      return new ProviderAdapterRequestError({
        ...error,
        provider: PROVIDER,
      });
    case "ProviderAdapterProcessError":
      return new ProviderAdapterProcessError({
        ...error,
        provider: PROVIDER,
      });
  }
}

const mapPoolsideError = <A>(effect: Effect.Effect<A, ProviderAdapterError>) =>
  effect.pipe(Effect.mapError(toPoolsideError));

export function makePoolsideAdapter(
  poolsideSettings: { readonly binaryPath?: string } = {},
  options?: CursorAdapterLiveOptions,
) {
  return Effect.gen(function* () {
    const delegate = yield* makeCursorAdapter(
      {
        binaryPath: poolsideSettings.binaryPath || "pool",
        authMethodId: null,
      },
      { ...options, acpOnlyModelDiscovery: true },
    );

    const adapter: PoolsideAdapterShape = {
      provider: PROVIDER,
      capabilities: {
        ...delegate.capabilities,
        sessionModelSwitch: "in-session",
        supportsRuntimeModelList: true,
      },
      startSession: (input) =>
        mapPoolsideError(delegate.startSession(toCursorStartInput(input))).pipe(
          Effect.map(toPoolsideSession),
        ),
      sendTurn: (input) => mapPoolsideError(delegate.sendTurn(input)),
      interruptTurn: (threadId, turnId) =>
        mapPoolsideError(delegate.interruptTurn(threadId, turnId)),
      readThread: (threadId) => mapPoolsideError(delegate.readThread(threadId)),
      ...(delegate.rollbackThread
        ? {
            rollbackThread: (threadId, numTurns) =>
              mapPoolsideError(delegate.rollbackThread!(threadId, numTurns)),
          }
        : {}),
      ...(delegate.forkThread
        ? {
            forkThread: (input) =>
              mapPoolsideError(
                delegate.forkThread!({
                  ...input,
                  ...(input.modelSelection
                    ? { modelSelection: toCursorModelSelection(input.modelSelection) }
                    : {}),
                  ...(input.providerOptions
                    ? { providerOptions: toCursorProviderOptions(input.providerOptions) }
                    : {}),
                }),
              ),
          }
        : {}),
      respondToRequest: (threadId, requestId, decision) =>
        mapPoolsideError(delegate.respondToRequest(threadId, requestId, decision)),
      ...(delegate.respondToUserInput
        ? {
            respondToUserInput: (threadId, requestId, answers) =>
              mapPoolsideError(delegate.respondToUserInput!(threadId, requestId, answers)),
          }
        : {}),
      stopSession: (threadId) => mapPoolsideError(delegate.stopSession(threadId)),
      listSessions: () => delegate.listSessions().pipe(Effect.map((items) => items.map(toPoolsideSession))),
      getComposerCapabilities: () =>
        delegate.getComposerCapabilities!().pipe(
          Effect.map((capabilities) => ({
            ...capabilities,
            provider: PROVIDER,
            supportsSkillMentions: true,
            supportsSkillDiscovery: true,
            supportsRuntimeModelList: true,
          })),
        ),
      listModels: (input) =>
        mapPoolsideError(
          delegate.listModels!({
            ...input,
            provider: DELEGATE_PROVIDER,
            binaryPath: input.binaryPath || poolsideSettings.binaryPath || "pool",
          }),
        ).pipe(Effect.map(toPoolsideModels)),
      hasSession: (threadId) => delegate.hasSession(threadId),
      stopAll: () => delegate.stopAll(),
      streamEvents: Stream.map(delegate.streamEvents, toPoolsideEvent),
    };
    return adapter;
  });
}

export const PoolsideAdapterLive = Layer.effect(PoolsideAdapter, makePoolsideAdapter());

export function makePoolsideAdapterLive(
  poolsideSettings: { readonly binaryPath?: string } = {},
  options?: CursorAdapterLiveOptions,
) {
  return Layer.effect(PoolsideAdapter, makePoolsideAdapter(poolsideSettings, options));
}
