// FILE: GithubCopilotProvider.ts
// Purpose: Provider status probing for GitHub Copilot CLI - version check via
//          `copilot --version`, adapted from GrokProvider.ts. Deliberately
//          does NOT try to discover a model list via ACP the way Grok's does:
//          a real `copilot --acp` session/new response (verified live,
//          unauthenticated, against v1.0.80) returns `configOptions` for
//          "mode" and "allow_all" but nothing model-related - model choice is
//          a `--model <name>` CLI flag / `/model` slash command, not
//          something the ACP handshake enumerates. The built-in catalog is
//          the CLI's documented `auto` default plus the models listed in
//          Copilot CLI's own docs (`copilot --help` / command reference);
//          anything else goes through `customModels`, same escape hatch
//          every other driver here uses for models this tree can't
//          otherwise verify. Reasoning effort and context window are
//          spawn-time `--effort` / `--context` flags, advertised as
//          optionDescriptors so the composer traits picker can set them.
//
//          Auth state is left "unknown" like Grok's probe already does - a
//          real `copilot --acp` session/new succeeded live even
//          unauthenticated (Copilot appears to only require login once an
//          actual prompt is sent), so "session/new succeeded" cannot be used
//          as a login signal, and this tree has no verified way to read
//          Copilot's own credential state from disk. Users will discover an
//          unauthenticated session at prompt time instead of from this probe
//          - see the module header on GithubCopilotAcpSupport.ts for what was
//          and wasn't verified.
// @module provider/Layers/GithubCopilotProvider

import {
  type GithubCopilotSettings,
  type ModelCapabilities,
  type ProviderOptionDescriptor,
  type ServerProvider,
  type ServerProviderModel,
} from "@modesto/contracts";
import { causeErrorTag } from "@modesto/shared/observability";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { HttpClient } from "effect/unstable/http";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { createModelCapabilities } from "@modesto/shared/model";
import { resolveSpawnCommand } from "@modesto/shared/shell";

import {
  buildServerProvider,
  isCommandMissingCause,
  parseGenericCliVersion,
  providerModelsFromSettings,
  spawnAndCollect,
  type ServerProviderDraft,
} from "../providerSnapshot.ts";
import {
  enrichProviderSnapshotWithVersionAdvisory,
  type ProviderMaintenanceCapabilities,
} from "../providerMaintenance.ts";

const GITHUB_COPILOT_PRESENTATION = {
  displayName: "GitHub Copilot",
  showInteractionModeToggle: false,
  // Deliberately NOT requiresNewThreadForModelChange: model is spawn-time
  // only (see GithubCopilotAcpSupport.ts), but the adapter's
  // `sessionModelSwitch: "unsupported"` capability already tells Modesto's
  // orchestration layer to restart the underlying session on a model change
  // rather than block it - the thread and its history stay put, only the
  // CLI process underneath restarts. requiresNewThreadForModelChange is a
  // stronger, provider-wide "you cannot change models on this thread at
  // all" flag (Grok's real behavior) that would be needlessly restrictive
  // here.
} as const;
const VERSION_PROBE_TIMEOUT_MS = 4_000;

const GITHUB_COPILOT_OPTION_DESCRIPTORS: ReadonlyArray<ProviderOptionDescriptor> = [
  {
    id: "reasoningEffort",
    label: "Reasoning",
    type: "select",
    options: [
      { id: "none", label: "None" },
      { id: "minimal", label: "Minimal" },
      { id: "low", label: "Low" },
      { id: "medium", label: "Medium", isDefault: true },
      { id: "high", label: "High" },
      { id: "xhigh", label: "Extra High" },
      { id: "max", label: "Max" },
    ],
    currentValue: "medium",
  },
  {
    id: "contextWindow",
    label: "Context Window",
    type: "select",
    options: [
      { id: "default", label: "Default", isDefault: true },
      { id: "long_context", label: "Long context" },
    ],
    currentValue: "default",
  },
];

const GITHUB_COPILOT_CAPABILITIES: ModelCapabilities = createModelCapabilities({
  optionDescriptors: GITHUB_COPILOT_OPTION_DESCRIPTORS,
});

const GITHUB_COPILOT_BUILT_IN_MODELS: ReadonlyArray<ServerProviderModel> = [
  {
    slug: "auto",
    name: "Auto",
    isCustom: false,
    isDefault: true,
    capabilities: GITHUB_COPILOT_CAPABILITIES,
  },
  {
    slug: "claude-sonnet-4.6",
    name: "Claude Sonnet 4.6",
    isCustom: false,
    capabilities: GITHUB_COPILOT_CAPABILITIES,
  },
  { slug: "gpt-5.4", name: "GPT-5.4", isCustom: false, capabilities: GITHUB_COPILOT_CAPABILITIES },
  {
    slug: "gpt-5.3-codex",
    name: "GPT-5.3 Codex",
    isCustom: false,
    capabilities: GITHUB_COPILOT_CAPABILITIES,
  },
  {
    slug: "claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    isCustom: false,
    capabilities: GITHUB_COPILOT_CAPABILITIES,
  },
  {
    slug: "claude-opus-4.8",
    name: "Claude Opus 4.8",
    isCustom: false,
    capabilities: GITHUB_COPILOT_CAPABILITIES,
  },
  {
    slug: "gpt-5.4-mini",
    name: "GPT-5.4 mini",
    isCustom: false,
    capabilities: GITHUB_COPILOT_CAPABILITIES,
  },
  {
    slug: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    isCustom: false,
    capabilities: GITHUB_COPILOT_CAPABILITIES,
  },
];

export function buildInitialGithubCopilotProviderSnapshot(
  githubCopilotSettings: GithubCopilotSettings,
): Effect.Effect<ServerProviderDraft> {
  return Effect.gen(function* () {
    const checkedAt = yield* Effect.map(DateTime.now, DateTime.formatIso);
    const models = githubCopilotModelsFromSettings(githubCopilotSettings.customModels);

    if (!githubCopilotSettings.enabled) {
      return buildServerProvider({
        presentation: GITHUB_COPILOT_PRESENTATION,
        enabled: false,
        checkedAt,
        models,
        probe: {
          installed: false,
          version: null,
          status: "warning",
          auth: { status: "unknown" },
          message: "GitHub Copilot is disabled in Modesto settings.",
        },
      });
    }

    return buildServerProvider({
      presentation: GITHUB_COPILOT_PRESENTATION,
      enabled: true,
      checkedAt,
      models,
      probe: {
        installed: true,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: "Checking GitHub Copilot CLI availability...",
      },
    });
  });
}

function githubCopilotModelsFromSettings(
  customModels: ReadonlyArray<string> | undefined,
): ReadonlyArray<ServerProviderModel> {
  return providerModelsFromSettings(
    GITHUB_COPILOT_BUILT_IN_MODELS,
    customModels ?? [],
    GITHUB_COPILOT_CAPABILITIES,
  );
}

const runGithubCopilotVersionCommand = (
  githubCopilotSettings: GithubCopilotSettings,
  environment: NodeJS.ProcessEnv = process.env,
) =>
  Effect.gen(function* () {
    const command = githubCopilotSettings.binaryPath || "copilot";
    const spawnCommand = yield* resolveSpawnCommand(command, ["--version"], {
      env: environment,
    });
    return yield* spawnAndCollect(
      command,
      ChildProcess.make(spawnCommand.command, spawnCommand.args, {
        env: environment,
        shell: spawnCommand.shell,
      }),
    );
  });

export const checkGithubCopilotProviderStatus = Effect.fn("checkGithubCopilotProviderStatus")(
  function* (
    githubCopilotSettings: GithubCopilotSettings,
    environment: NodeJS.ProcessEnv = process.env,
  ): Effect.fn.Return<ServerProviderDraft, never, ChildProcessSpawner.ChildProcessSpawner> {
    const checkedAt = DateTime.formatIso(yield* DateTime.now);
    const models = githubCopilotModelsFromSettings(githubCopilotSettings.customModels);

    if (!githubCopilotSettings.enabled) {
      return buildServerProvider({
        presentation: GITHUB_COPILOT_PRESENTATION,
        enabled: false,
        checkedAt,
        models,
        probe: {
          installed: false,
          version: null,
          status: "warning",
          auth: { status: "unknown" },
          message: "GitHub Copilot is disabled in Modesto settings.",
        },
      });
    }

    const versionResult = yield* runGithubCopilotVersionCommand(
      githubCopilotSettings,
      environment,
    ).pipe(Effect.timeoutOption(VERSION_PROBE_TIMEOUT_MS), Effect.result);

    if (Result.isFailure(versionResult)) {
      const error = versionResult.failure;
      yield* Effect.logWarning("GitHub Copilot CLI health check failed.", {
        errorTag: error._tag,
      });
      return buildServerProvider({
        presentation: GITHUB_COPILOT_PRESENTATION,
        enabled: githubCopilotSettings.enabled,
        checkedAt,
        models,
        probe: {
          installed: !isCommandMissingCause(error),
          version: null,
          status: "error",
          auth: { status: "unknown" },
          message: isCommandMissingCause(error)
            ? "GitHub Copilot CLI (`copilot`) is not installed or not on PATH."
            : "Failed to execute GitHub Copilot CLI health check.",
        },
      });
    }

    if (Option.isNone(versionResult.success)) {
      return buildServerProvider({
        presentation: GITHUB_COPILOT_PRESENTATION,
        enabled: githubCopilotSettings.enabled,
        checkedAt,
        models,
        probe: {
          installed: true,
          version: null,
          status: "error",
          auth: { status: "unknown" },
          message:
            "GitHub Copilot CLI is installed but timed out while running `copilot --version`.",
        },
      });
    }

    const versionOutput = versionResult.success.value;
    const version = parseGenericCliVersion(`${versionOutput.stdout}\n${versionOutput.stderr}`);
    if (versionOutput.code !== 0) {
      yield* Effect.logWarning("GitHub Copilot CLI version probe exited with a non-zero status.", {
        exitCode: versionOutput.code,
        stdoutLength: versionOutput.stdout.length,
        stderrLength: versionOutput.stderr.length,
      });
      return buildServerProvider({
        presentation: GITHUB_COPILOT_PRESENTATION,
        enabled: githubCopilotSettings.enabled,
        checkedAt,
        models,
        probe: {
          installed: true,
          version,
          status: "error",
          auth: { status: "unknown" },
          message: "GitHub Copilot CLI is installed but failed to run.",
        },
      });
    }

    return buildServerProvider({
      presentation: GITHUB_COPILOT_PRESENTATION,
      enabled: githubCopilotSettings.enabled,
      checkedAt,
      models,
      probe: {
        installed: true,
        version,
        status: "ready",
        auth: { status: "unknown" },
      },
    });
  },
);

export const enrichGithubCopilotSnapshot = (input: {
  readonly snapshot: ServerProvider;
  readonly maintenanceCapabilities: ProviderMaintenanceCapabilities;
  readonly enableProviderUpdateChecks?: boolean;
  readonly publishSnapshot: (snapshot: ServerProvider) => Effect.Effect<void>;
  readonly httpClient: HttpClient.HttpClient;
}): Effect.Effect<void> => {
  const { snapshot, publishSnapshot } = input;

  return enrichProviderSnapshotWithVersionAdvisory(snapshot, input.maintenanceCapabilities, {
    enableProviderUpdateChecks: input.enableProviderUpdateChecks,
  }).pipe(
    Effect.provideService(HttpClient.HttpClient, input.httpClient),
    Effect.flatMap((enrichedSnapshot) => publishSnapshot(enrichedSnapshot)),
    Effect.catchCause((cause) =>
      Effect.logWarning("GitHub Copilot version advisory enrichment failed", {
        errorTag: causeErrorTag(cause),
      }),
    ),
    Effect.asVoid,
  );
};
