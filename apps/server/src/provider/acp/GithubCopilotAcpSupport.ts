// FILE: GithubCopilotAcpSupport.ts
// Purpose: Spawn/auth glue between the generic AcpSessionRuntime and GitHub
//          Copilot CLI's ACP server (`copilot --acp`), verified live against
//          a real installed `copilot` binary (v1.0.80) - not guessed from
//          docs alone. `copilot --acp` over stdio replied to a real
//          `initialize` call with exactly one auth method:
//          `{id: "copilot-login", name: "Log in with Copilot CLI", ...}` -
//          that id is hardcoded below rather than resolved dynamically like
//          Grok's (which switches between an API-key and a cached-token
//          method), since Copilot only ever advertised the one.
//
// Model, reasoning effort, and context window are spawn-time CLI flags
// (`--model`, `--effort`, `--context`). `session/new` returns configOptions
// for "mode" and "allow_all" but nothing for picking a model, so those
// values are set once at process start and never switched live - see
// GithubCopilotAdapter.ts's `capabilities: { sessionModelSwitch:
// "unsupported" }`, which tells Modesto's orchestration layer to restart
// the session instead of attempting a live switch.
//
// @module provider/acp/GithubCopilotAcpSupport
import { type GithubCopilotSettings, type ModelSelection } from "@modesto/contracts";
import { getModelSelectionStringOptionValue } from "@modesto/shared/model";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import type * as EffectAcpErrors from "effect-acp/errors";

import * as AcpSessionRuntime from "./AcpSessionRuntime.ts";

const GITHUB_COPILOT_AUTH_METHOD_ID = "copilot-login";

type GithubCopilotAcpRuntimeSettings = Pick<GithubCopilotSettings, "binaryPath">;

export interface GithubCopilotAcpSpawnFlags {
  readonly model?: string | undefined;
  readonly reasoningEffort?: string | undefined;
  readonly contextWindow?: string | undefined;
}

export interface GithubCopilotAcpRuntimeInput extends Omit<
  AcpSessionRuntime.AcpSessionRuntimeOptions,
  "authMethodId" | "clientCapabilities" | "spawn"
> {
  readonly childProcessSpawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
  readonly githubCopilotSettings: GithubCopilotAcpRuntimeSettings | null | undefined;
  readonly environment?: NodeJS.ProcessEnv;
  /** Resolved once at spawn time - see the module header for why this never changes mid-session. */
  readonly model?: string | undefined;
  readonly reasoningEffort?: string | undefined;
  readonly contextWindow?: string | undefined;
}

function trimFlag(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveGithubCopilotAcpSpawnFlags(
  input: GithubCopilotAcpSpawnFlags,
): GithubCopilotAcpSpawnFlags {
  const model = trimFlag(input.model);
  const reasoningEffort = trimFlag(input.reasoningEffort);
  const contextWindow = trimFlag(input.contextWindow);
  return {
    ...(model ? { model } : {}),
    ...(reasoningEffort ? { reasoningEffort } : {}),
    ...(contextWindow && contextWindow !== "default" ? { contextWindow } : {}),
  };
}

export function githubCopilotAcpSpawnFlagsFromModelSelection(
  modelSelection: ModelSelection | undefined,
): GithubCopilotAcpSpawnFlags {
  return resolveGithubCopilotAcpSpawnFlags({
    model: modelSelection?.model,
    reasoningEffort: getModelSelectionStringOptionValue(modelSelection, "reasoningEffort"),
    contextWindow: getModelSelectionStringOptionValue(modelSelection, "contextWindow"),
  });
}

export function buildGithubCopilotAcpSpawnInput(
  githubCopilotSettings: GithubCopilotAcpRuntimeSettings | null | undefined,
  cwd: string,
  flags: GithubCopilotAcpSpawnFlags | undefined,
  environment?: NodeJS.ProcessEnv,
): AcpSessionRuntime.AcpSpawnInput {
  const resolved = resolveGithubCopilotAcpSpawnFlags(flags ?? {});
  const args = ["--acp"];
  if (resolved.model) {
    args.push("--model", resolved.model);
  }
  if (resolved.reasoningEffort) {
    args.push("--effort", resolved.reasoningEffort);
  }
  if (resolved.contextWindow) {
    args.push("--context", resolved.contextWindow);
  }
  return {
    command: githubCopilotSettings?.binaryPath || "copilot",
    // stdio is inferred by default (verified live - `copilot --acp` alone
    // speaks NDJSON over stdio with no extra flag needed).
    args,
    cwd,
    ...(environment ? { env: environment } : {}),
  };
}

export const makeGithubCopilotAcpRuntime = (
  input: GithubCopilotAcpRuntimeInput,
): Effect.Effect<
  AcpSessionRuntime.AcpSessionRuntime["Service"],
  EffectAcpErrors.AcpError,
  Crypto.Crypto | Scope.Scope
> =>
  Effect.gen(function* () {
    const acpContext = yield* Layer.build(
      AcpSessionRuntime.layer({
        ...input,
        spawn: buildGithubCopilotAcpSpawnInput(
          input.githubCopilotSettings,
          input.cwd,
          {
            model: input.model,
            reasoningEffort: input.reasoningEffort,
            contextWindow: input.contextWindow,
          },
          input.environment,
        ),
        authMethodId: GITHUB_COPILOT_AUTH_METHOD_ID,
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
