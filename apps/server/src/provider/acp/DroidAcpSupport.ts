// FILE: DroidAcpSupport.ts
// Purpose: Spawn/auth glue between the generic AcpSessionRuntime and Factory
//          Droid's ACP server (`droid exec --output-format acp`), ported
//          from the primary Modesto tree's DroidAcpSupport.ts (NOT verified
//          live - no `droid` binary is installed on this machine, unlike the
//          GitHub Copilot port; every claim below traces back to that
//          source file, not a live handshake).
//
// Auth method resolution is simplified from the primary tree's version: the
// source resolves it dynamically post-`initialize` (resolveAuthMethodId,
// checking which of "factory-api-key"/"device-pairing" the live response
// actually advertises before picking). This tree's generic
// AcpSessionRuntime only supports a fixed `authMethodId` decided before
// spawn (same shape GrokAcpSupport.ts uses), so this mirrors Grok's already-
// proven pattern instead: resolve purely from whether FACTORY_API_KEY is set
// in the environment, without checking the live advertised method list.
//
// Model selection is also simplified: the source applies model and
// reasoning-effort over ACP (`session/set_config_option`) and can re-apply
// them on a live model change mid-session. This v1 applies them once, right
// after the session starts (see DroidAdapter.ts), and reports
// `capabilities: { sessionModelSwitch: "unsupported" }` - matching Copilot's
// spawn-time-only precedent - rather than porting the source's full
// per-turn "does the requested model differ from current" reconciliation.
//
// Deliberately NOT ported in this v1 (all real hardening in the source file
// this was adapted from - flagged here rather than silently dropped):
// - Resume-replay quiet-period/hard-timeout tuning.
// - The transport debug-marker stripping / MODESTO_DROID_ACP_DEBUG logging.
// - Model-discovery caching (discoverDroidAcpModels's 5-minute cache).
// - The DROID_RESOURCE_DISCIPLINE_PROMPT auto-appended system prompt.
// - Native Plan/Ask mode via `session/set_config_option` "autonomy_level" -
//   no ACP provider in this tree wires interaction-mode switching yet
//   (Grok and GitHub Copilot don't either), so Droid isn't a regression
//   here, just not yet ahead of them.
// - DroidSessionTeardownGate: the source needs it because its
//   `stopSessionInternal` forks teardown into the background
//   (`Effect.forkDetach`) so `stopSession` returns without waiting, which
//   means a same-thread `startSession` racing in afterward could otherwise
//   spawn a new process before the old one actually exited - the gate is
//   what closes that window. This tree's adapters (Grok, GitHub Copilot,
//   Custom ACP Agent, and this Droid port) all close their session scope
//   *synchronously* inside `stopSessionInternal`, still under the same
//   per-thread lock `startSession` also acquires, so that race can't happen
//   here in the first place - a separate gate would be dead code.
// - DroidTurnCancellation's cancel-then-wait-then-escalate: needs a real
//   `Fiber` for the in-flight prompt call, which the source has because it
//   forks the prompt call onto its own fiber. This tree's `sendTurn` runs
//   the prompt call inline instead (the proven pattern every ACP adapter
//   here shares), so `interruptTurn` stays the same bare fire-and-forget
//   `ctx.acp.cancel` Copilot/Grok/Custom ACP Agent already use - see
//   DroidAdapter.ts's header for the fuller reasoning.
//
// @module provider/acp/DroidAcpSupport
import { existsSync } from "node:fs";
import * as nodeOs from "node:os";
import * as nodePath from "node:path";

import { type DroidSettings } from "@modesto/contracts";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import type * as EffectAcpErrors from "effect-acp/errors";

import * as AcpSessionRuntime from "./AcpSessionRuntime.ts";

const DROID_API_KEY_ENV = "FACTORY_API_KEY";
const DROID_API_KEY_AUTH_METHOD_ID = "factory-api-key";
const DROID_DEVICE_PAIRING_AUTH_METHOD_ID = "device-pairing";

export function hasDroidApiKeyEnv(env: NodeJS.ProcessEnv | undefined): boolean {
  return Boolean(env?.[DROID_API_KEY_ENV]?.trim());
}

function resolveDroidAuthMethodId(env: NodeJS.ProcessEnv | undefined): string {
  return hasDroidApiKeyEnv(env)
    ? DROID_API_KEY_AUTH_METHOD_ID
    : DROID_DEVICE_PAIRING_AUTH_METHOD_ID;
}

/** Honors PATH first, then falls back to Factory's common `~/.local/bin` install location - ported verbatim from the source file's identical resolution logic. */
export function resolveDroidCliBinaryPath(binaryPath?: string | null): string {
  const configured = binaryPath?.trim();
  if (configured) {
    return configured;
  }
  const name = "droid";
  const searchPath = process.env.PATH ?? "";
  for (const directory of searchPath.split(nodePath.delimiter)) {
    if (!directory.trim()) {
      continue;
    }
    const candidate = nodePath.join(directory, name);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  if (process.platform !== "win32") {
    const localBin = nodePath.join(nodeOs.homedir(), ".local", "bin", name);
    if (existsSync(localBin)) {
      return localBin;
    }
  }
  return name;
}

type DroidAcpRuntimeSettings = Pick<
  DroidSettings,
  "binaryPath" | "reasoningEffort" | "appendSystemPrompt" | "skipPermissionsUnsafe"
>;

export interface DroidAcpRuntimeInput extends Omit<
  AcpSessionRuntime.AcpSessionRuntimeOptions,
  "authMethodId" | "clientCapabilities" | "spawn"
> {
  readonly childProcessSpawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
  readonly droidSettings: DroidAcpRuntimeSettings | null | undefined;
  readonly environment?: NodeJS.ProcessEnv;
  /** Resolved once at spawn time - see the module header for why this doesn't live-switch in v1. */
  readonly model?: string | undefined;
}

export function buildDroidAcpSpawnInput(
  droidSettings: DroidAcpRuntimeSettings | null | undefined,
  cwd: string,
  model: string | undefined,
  environment?: NodeJS.ProcessEnv,
): AcpSessionRuntime.AcpSpawnInput {
  const args = ["exec", "--output-format", "acp"];
  if (droidSettings?.skipPermissionsUnsafe === true) {
    args.push("--skip-permissions-unsafe");
  }
  const appendSystemPrompt = droidSettings?.appendSystemPrompt?.trim();
  if (appendSystemPrompt) {
    args.push("--append-system-prompt", appendSystemPrompt);
  }
  const trimmedModel = model?.trim();
  if (trimmedModel) {
    args.push("-m", trimmedModel);
  }
  const reasoningEffort = droidSettings?.reasoningEffort?.trim();
  if (reasoningEffort) {
    args.push("-r", reasoningEffort);
  }
  return {
    command: resolveDroidCliBinaryPath(droidSettings?.binaryPath),
    args,
    cwd,
    ...(environment ? { env: environment } : {}),
  };
}

export const makeDroidAcpRuntime = (
  input: DroidAcpRuntimeInput,
): Effect.Effect<
  AcpSessionRuntime.AcpSessionRuntime["Service"],
  EffectAcpErrors.AcpError,
  Crypto.Crypto | Scope.Scope
> =>
  Effect.gen(function* () {
    const acpContext = yield* Layer.build(
      AcpSessionRuntime.layer({
        ...input,
        spawn: buildDroidAcpSpawnInput(
          input.droidSettings,
          input.cwd,
          input.model,
          input.environment,
        ),
        authMethodId: resolveDroidAuthMethodId(input.environment),
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

/**
 * Applies the requested model and reasoning effort once, right after the
 * session starts - ported from the source file's `applyDroidAcpModelSelection`,
 * minus the live per-turn reconciliation (see the module header).
 */
export function applyDroidAcpModelSelection<E>(input: {
  readonly runtime: Pick<AcpSessionRuntime.AcpSessionRuntime["Service"], "setConfigOption">;
  readonly model: string | undefined;
  readonly reasoningEffort: string | undefined;
  readonly mapError: (cause: EffectAcpErrors.AcpError) => E;
}): Effect.Effect<void, E> {
  return Effect.gen(function* () {
    const model = input.model?.trim();
    if (model) {
      yield* input.runtime.setConfigOption("model", model).pipe(Effect.mapError(input.mapError));
    }
    const reasoningEffort = input.reasoningEffort?.trim();
    if (reasoningEffort) {
      yield* input.runtime
        .setConfigOption("reasoning_effort", reasoningEffort)
        .pipe(Effect.mapError(input.mapError));
    }
  });
}
