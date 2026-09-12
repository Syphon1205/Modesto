// FILE: GeminiAcpSupport.ts
// Purpose: Spawn/auth/model glue between the generic AcpSessionRuntime and
//          Gemini CLI's ACP server (`gemini --acp`). Traced from the primary
//          Modesto tree's real, working Gemini integration
//          (apps/server/src/provider/{geminiAcpProbe,Layers/GeminiAdapter}.ts)
//          - NOT verified live against a real `gemini` binary in this
//          migration tree (none installed here). Every fact below traces to
//          that source, same "traced from source only" discipline used for
//          Factory Droid's port.
//
// Gemini genuinely speaks real ACP (initialize/session/new/session/prompt/
// session/cancel/session/set_model, all confirmed via the primary tree's
// literal wire calls) - it is not the hand-rolled bespoke-protocol case Pi
// is. That means this port reuses the same generic AcpSessionRuntime every
// other ACP provider here (Cursor/Grok/Copilot/Droid/Custom ACP Agent)
// already runs on, rather than a new runtime.
//
// Facts from the primary tree's source, all in `Layers/GeminiAdapter.ts`
// unless noted:
// - Binary `gemini`, spawned as `gemini --acp` (also confirmed in
//   `geminiAcpProbe.ts`) - no extra flags, no `--model` startup flag (unlike
//   Copilot). Model is entirely a live `session/set_model` concern.
// - `authenticate` is never called - Gemini CLI manages its own auth
//   externally (API key / Vertex AI env vars, or its own `gemini` CLI login
//   flow), the same reason the generic Custom ACP Agent driver skips it.
// - `session/new`'s response carries a standard ACP `models: SessionModelState
//   {availableModels: ModelInfo[], currentModelId}` (see
//   packages/effect-acp/src/_generated/schema.gen.ts) - live model switching
//   goes through the ACP `session/set_model` capability, exactly like Grok's
//   `session/set_model` usage (see `applyGrokAcpModelSelection` in
//   GrokAcpSupport.ts, which this module's `applyGeminiAcpModelSelection`
//   mirrors).
//
// Deliberately NOT ported from the primary tree, each a documented scope cut
// consistent with what every other ACP provider in this tree has already
// cut:
// - `session/set_mode` (Agent/Plan-style modes) - no other ACP provider here
//   wires `setMode` either.
// - The Gemini-specific thinking-budget "model config aliases" mechanism
//   (`buildGeminiThinkingModelConfigAliases`) and per-model-tier
//   `ModelCapabilities` (GEMINI_2_5 vs GEMINI_3 option descriptors) -
//   discovered models get `EMPTY_CAPABILITIES` here, the same simplification
//   Grok's own ACP-discovered models already use.
//   Modesto's Connections/Cowork MCP-server translation
//   (`translateCodexMcpServersForAcp`) - this tree's own, simpler
//   `McpProviderSession` passthrough (Modesto's built-in MCP server) is used
//   instead, matching Grok/Copilot exactly.
// - Rich auth-state detection (API-key/Vertex-AI/Code-Assist-migration
//   messages, OAuth-browser-prompt log scanning) - auth is reported
//   "unknown" here, the same simplification Grok/Copilot's probes already
//   make. The one piece of that machinery kept: real background health-check
//   probes must never pop an OAuth browser, so the provider-status probe
//   (not real sessions) spawns with `NO_BROWSER`/`BROWSER`/`CI` env
//   overrides - see GeminiProvider.ts.
//
// @module provider/acp/GeminiAcpSupport
import { type GeminiSettings } from "@modesto/contracts";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import * as EffectAcpErrors from "effect-acp/errors";
import type * as EffectAcpSchema from "effect-acp/schema";

import * as AcpSessionRuntime from "./AcpSessionRuntime.ts";

type GeminiAcpRuntimeSettings = Pick<GeminiSettings, "binaryPath">;

export interface GeminiAcpRuntimeInput extends Omit<
  AcpSessionRuntime.AcpSessionRuntimeOptions,
  "authMethodId" | "clientCapabilities" | "spawn"
> {
  readonly childProcessSpawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
  readonly geminiSettings: GeminiAcpRuntimeSettings | null | undefined;
  readonly environment?: NodeJS.ProcessEnv;
}

export function buildGeminiAcpSpawnInput(
  geminiSettings: GeminiAcpRuntimeSettings | null | undefined,
  cwd: string,
  environment?: NodeJS.ProcessEnv,
): AcpSessionRuntime.AcpSpawnInput {
  return {
    command: geminiSettings?.binaryPath || "gemini",
    args: ["--acp"],
    cwd,
    ...(environment ? { env: environment } : {}),
  };
}

export const makeGeminiAcpRuntime = (
  input: GeminiAcpRuntimeInput,
): Effect.Effect<
  AcpSessionRuntime.AcpSessionRuntime["Service"],
  EffectAcpErrors.AcpError,
  Crypto.Crypto | Scope.Scope
> =>
  Effect.gen(function* () {
    const acpContext = yield* Layer.build(
      AcpSessionRuntime.layer({
        ...input,
        spawn: buildGeminiAcpSpawnInput(input.geminiSettings, input.cwd, input.environment),
        // Gemini CLI manages its own auth externally - see the module header.
        authMethodId: undefined,
        clientCapabilities: {
          auth: { terminal: false },
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

export function resolveGeminiAcpModelId(model: string | null | undefined): string | undefined {
  const trimmed = model?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function currentGeminiModelIdFromSessionSetup(
  sessionSetupResult:
    | EffectAcpSchema.LoadSessionResponse
    | EffectAcpSchema.NewSessionResponse
    | EffectAcpSchema.ResumeSessionResponse,
): string | undefined {
  return sessionSetupResult.models?.currentModelId?.trim() || undefined;
}

export function applyGeminiAcpModelSelection<E>(input: {
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
