// FILE: DroidProvider.ts
// Purpose: Provider status probing for Factory Droid CLI - version check via
//          `droid --version`, adapted from GithubCopilotProvider.ts. Not
//          verified live (no `droid` binary installed on this machine) - see
//          DroidAcpSupport.ts's header for what's ported from source vs.
//          simplified.
//
//          No model catalog: the source discovers Droid's real model list
//          live via ACP (`discoverDroidAcpModels`, a disposable session that
//          walks `session/set_config_option`'s advertised options). That's
//          real, verified-shape logic in the source, but porting it means a
//          background health check would spawn a real `droid exec` process
//          just to list models - not something to add without a live binary
//          to confirm the flow actually works end-to-end. `customModels` is
//          the escape hatch instead, same as every other driver here that
//          can't otherwise verify a model list.
//
//          Auth state is left "unknown", matching every other ACP provider
//          in this tree (Grok, GitHub Copilot) - this tree has no verified
//          way to read Droid's own credential state from disk or infer it
//          from a probe that doesn't attempt authentication.
// @module provider/Layers/DroidProvider

import {
  type DroidSettings,
  type ModelCapabilities,
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

import { resolveDroidCliBinaryPath } from "../acp/DroidAcpSupport.ts";
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

const DROID_PRESENTATION = {
  displayName: "Factory Droid",
  showInteractionModeToggle: false,
  // Deliberately NOT requiresNewThreadForModelChange - model is applied via
  // a config-option call after spawn (see DroidAcpSupport.ts), and the
  // adapter's `sessionModelSwitch: "unsupported"` capability already tells
  // Modesto's orchestration layer to restart the session on a model change
  // rather than block it.
} as const;
const EMPTY_CAPABILITIES: ModelCapabilities = createModelCapabilities({
  optionDescriptors: [],
});

const VERSION_PROBE_TIMEOUT_MS = 4_000;

const DROID_BUILT_IN_MODELS: ReadonlyArray<ServerProviderModel> = [];

export function buildInitialDroidProviderSnapshot(
  droidSettings: DroidSettings,
): Effect.Effect<ServerProviderDraft> {
  return Effect.gen(function* () {
    const checkedAt = yield* Effect.map(DateTime.now, DateTime.formatIso);
    const models = droidModelsFromSettings(droidSettings.customModels);

    if (!droidSettings.enabled) {
      return buildServerProvider({
        presentation: DROID_PRESENTATION,
        enabled: false,
        checkedAt,
        models,
        probe: {
          installed: false,
          version: null,
          status: "warning",
          auth: { status: "unknown" },
          message: "Factory Droid is disabled in Modesto settings.",
        },
      });
    }

    return buildServerProvider({
      presentation: DROID_PRESENTATION,
      enabled: true,
      checkedAt,
      models,
      probe: {
        installed: true,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: "Checking Factory Droid CLI availability...",
      },
    });
  });
}

function droidModelsFromSettings(
  customModels: ReadonlyArray<string> | undefined,
): ReadonlyArray<ServerProviderModel> {
  return providerModelsFromSettings(DROID_BUILT_IN_MODELS, customModels ?? [], EMPTY_CAPABILITIES);
}

const runDroidVersionCommand = (
  droidSettings: DroidSettings,
  environment: NodeJS.ProcessEnv = process.env,
) =>
  Effect.gen(function* () {
    const command = resolveDroidCliBinaryPath(droidSettings.binaryPath);
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

export const checkDroidProviderStatus = Effect.fn("checkDroidProviderStatus")(function* (
  droidSettings: DroidSettings,
  environment: NodeJS.ProcessEnv = process.env,
): Effect.fn.Return<ServerProviderDraft, never, ChildProcessSpawner.ChildProcessSpawner> {
  const checkedAt = DateTime.formatIso(yield* DateTime.now);
  const models = droidModelsFromSettings(droidSettings.customModels);

  if (!droidSettings.enabled) {
    return buildServerProvider({
      presentation: DROID_PRESENTATION,
      enabled: false,
      checkedAt,
      models,
      probe: {
        installed: false,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: "Factory Droid is disabled in Modesto settings.",
      },
    });
  }

  const versionResult = yield* runDroidVersionCommand(droidSettings, environment).pipe(
    Effect.timeoutOption(VERSION_PROBE_TIMEOUT_MS),
    Effect.result,
  );

  if (Result.isFailure(versionResult)) {
    const error = versionResult.failure;
    yield* Effect.logWarning("Factory Droid CLI health check failed.", {
      errorTag: error._tag,
    });
    return buildServerProvider({
      presentation: DROID_PRESENTATION,
      enabled: droidSettings.enabled,
      checkedAt,
      models,
      probe: {
        installed: !isCommandMissingCause(error),
        version: null,
        status: "error",
        auth: { status: "unknown" },
        message: isCommandMissingCause(error)
          ? "Factory Droid CLI (`droid`) is not installed or not on PATH."
          : "Failed to execute Factory Droid CLI health check.",
      },
    });
  }

  if (Option.isNone(versionResult.success)) {
    return buildServerProvider({
      presentation: DROID_PRESENTATION,
      enabled: droidSettings.enabled,
      checkedAt,
      models,
      probe: {
        installed: true,
        version: null,
        status: "error",
        auth: { status: "unknown" },
        message: "Factory Droid CLI is installed but timed out while running `droid --version`.",
      },
    });
  }

  const versionOutput = versionResult.success.value;
  const version = parseGenericCliVersion(`${versionOutput.stdout}\n${versionOutput.stderr}`);
  if (versionOutput.code !== 0) {
    yield* Effect.logWarning("Factory Droid CLI version probe exited with a non-zero status.", {
      exitCode: versionOutput.code,
      stdoutLength: versionOutput.stdout.length,
      stderrLength: versionOutput.stderr.length,
    });
    return buildServerProvider({
      presentation: DROID_PRESENTATION,
      enabled: droidSettings.enabled,
      checkedAt,
      models,
      probe: {
        installed: true,
        version,
        status: "error",
        auth: { status: "unknown" },
        message: "Factory Droid CLI is installed but failed to run.",
      },
    });
  }

  return buildServerProvider({
    presentation: DROID_PRESENTATION,
    enabled: droidSettings.enabled,
    checkedAt,
    models,
    probe: {
      installed: true,
      version,
      status: "ready",
      auth: { status: "unknown" },
    },
  });
});

export const enrichDroidSnapshot = (input: {
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
      Effect.logWarning("Factory Droid version advisory enrichment failed", {
        errorTag: causeErrorTag(cause),
      }),
    ),
    Effect.asVoid,
  );
};
