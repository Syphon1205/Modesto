// FILE: MetaProvider.ts
// Purpose: Provider status probing for Muse Code - version check via
//          `muse --version`, plus live model discovery via a transient ACP
//          session, adapted from GrokProvider.ts (the closest existing
//          template: Grok is the only other provider here whose probe
//          discovers models over ACP rather than a fixed built-in list).
//
//          One real difference from Grok's probe, traced from the primary
//          Modesto tree's source (`metaAcpProbe.ts`, whose header there
//          says "Runs Meta probes as status checks only; they must never
//          launch an OAuth browser"): Muse Code can attempt an interactive
//          OAuth browser flow during `session/new` when unauthenticated,
//          which a background health-check probe must never trigger. The
//          primary tree's full defense is a spawn-env override
//          (`NO_BROWSER`/`BROWSER`/`CI`) plus scanning stdout/stderr lines
//          for OAuth-prompt patterns; this port keeps only the env override
//          (the cheap, load-bearing half) and drops the log-scanning
//          classifier - a documented scope cut, not an oversight. Auth state
//          is otherwise reported "unknown" here, the same simplification
//          Grok/Copilot's own probes already make (see MetaAcpSupport.ts's
//          header for the full list of what this port deliberately does not
//          carry over from the primary tree's much richer auth-detection
//          logic).
//
//          NOT verified live - no `muse` binary installed in this
//          migration tree; every fact traces to the primary tree's source.
// @module provider/Layers/MetaProvider

import {
  type MetaSettings,
  type ModelCapabilities,
  type ServerProvider,
  type ServerProviderModel,
} from "@modesto/contracts";
import type * as EffectAcpSchema from "effect-acp/schema";
import { causeErrorTag } from "@modesto/shared/observability";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { HttpClient } from "effect/unstable/http";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { createModelCapabilities } from "@modesto/shared/model";
import { resolveSpawnCommand } from "@modesto/shared/shell";

import {
  buildSelectOptionDescriptor,
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
import { makeMetaAcpRuntime, resolveMetaAcpModelId } from "../acp/MetaAcpSupport.ts";

const META_PRESENTATION = {
  displayName: "Meta",
  showInteractionModeToggle: false,
} as const;
const EMPTY_CAPABILITIES: ModelCapabilities = createModelCapabilities({
  optionDescriptors: [],
});

const META_SPARK_CAPABILITIES: ModelCapabilities = createModelCapabilities({
  optionDescriptors: [
    buildSelectOptionDescriptor({
      id: "effort",
      label: "Reasoning",
      options: [
        { value: "none", label: "None" },
        { value: "minimal", label: "Minimal" },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High", isDefault: true },
        { value: "xhigh", label: "Extra High" },
        { value: "max", label: "Max" },
      ],
    }),
  ],
});

const VERSION_PROBE_TIMEOUT_MS = 4_000;
const META_ACP_MODEL_DISCOVERY_TIMEOUT_MS = 15_000;

// A background health-check probe must never trigger Muse Code's
// interactive OAuth browser flow - see the module header.
const META_BROWSER_BLOCKLIST_VALUE = "www-browser";
function buildMetaProbeEnv(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...environment,
    NO_BROWSER: "true",
    BROWSER: META_BROWSER_BLOCKLIST_VALUE,
    CI: "true",
  };
}

const META_BUILT_IN_MODELS: ReadonlyArray<ServerProviderModel> = [
  {
    slug: "muse-spark-1.3",
    name: "Muse Spark 1.3",
    isCustom: false,
    isDefault: true,
    capabilities: META_SPARK_CAPABILITIES,
  },
  {
    slug: "muse-spark-1.3-contributor",
    name: "Muse Spark 1.3 Contributor",
    isCustom: false,
    capabilities: META_SPARK_CAPABILITIES,
  },
  {
    slug: "muse-spark-1.2",
    name: "Muse Spark 1.2",
    isCustom: false,
    capabilities: META_SPARK_CAPABILITIES,
  },
  {
    slug: "muse-spark-1.2-contributor",
    name: "Muse Spark 1.2 Contributor",
    isCustom: false,
    capabilities: META_SPARK_CAPABILITIES,
  },
  {
    slug: "muse-spark-1.1",
    name: "Muse Spark 1.1",
    isCustom: false,
    isLegacy: true,
    capabilities: META_SPARK_CAPABILITIES,
  },
];

export function buildInitialMetaProviderSnapshot(
  metaSettings: MetaSettings,
): Effect.Effect<ServerProviderDraft> {
  return Effect.gen(function* () {
    const checkedAt = yield* Effect.map(DateTime.now, DateTime.formatIso);
    const models = metaModelsFromSettings(metaSettings.customModels);

    if (!metaSettings.enabled) {
      return buildServerProvider({
        presentation: META_PRESENTATION,
        enabled: false,
        checkedAt,
        models,
        probe: {
          installed: false,
          version: null,
          status: "warning",
          auth: { status: "unknown" },
          message: "Meta is disabled in Modesto settings.",
        },
      });
    }

    return buildServerProvider({
      presentation: META_PRESENTATION,
      enabled: true,
      checkedAt,
      models,
      probe: {
        installed: true,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: "Checking Muse Code availability...",
      },
    });
  });
}

function metaModelsFromSettings(
  customModels: ReadonlyArray<string> | undefined,
  builtInModels: ReadonlyArray<ServerProviderModel> = META_BUILT_IN_MODELS,
): ReadonlyArray<ServerProviderModel> {
  return providerModelsFromSettings(builtInModels, customModels ?? [], EMPTY_CAPABILITIES);
}

function buildMetaDiscoveredModelsFromSessionModelState(
  modelState: EffectAcpSchema.SessionModelState | null | undefined,
): ReadonlyArray<ServerProviderModel> {
  if (!modelState || modelState.availableModels.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  return modelState.availableModels
    .map((model): ServerProviderModel | undefined => {
      const slug = resolveMetaAcpModelId(model.modelId);
      if (!slug || seen.has(slug)) {
        return undefined;
      }
      seen.add(slug);
      return {
        slug,
        name: model.name.trim() || slug,
        isCustom: false,
        capabilities: slug.startsWith("muse-spark-") ? META_SPARK_CAPABILITIES : EMPTY_CAPABILITIES,
      };
    })
    .filter((model): model is ServerProviderModel => model !== undefined);
}

const discoverMetaModelsViaAcp = (
  metaSettings: MetaSettings,
  environment: NodeJS.ProcessEnv = process.env,
) =>
  Effect.gen(function* () {
    const childProcessSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const acp = yield* makeMetaAcpRuntime({
      metaSettings,
      environment: buildMetaProbeEnv(environment),
      childProcessSpawner,
      cwd: process.cwd(),
      clientInfo: { name: "t3-code-provider-probe", version: "0.0.0" },
    });
    const started = yield* acp.start();
    return buildMetaDiscoveredModelsFromSessionModelState(started.sessionSetupResult.models);
  }).pipe(Effect.scoped);

const runMetaVersionCommand = (
  metaSettings: MetaSettings,
  environment: NodeJS.ProcessEnv = process.env,
) =>
  Effect.gen(function* () {
    const command = metaSettings.binaryPath || "muse";
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

export const checkMetaProviderStatus = Effect.fn("checkMetaProviderStatus")(function* (
  metaSettings: MetaSettings,
  environment: NodeJS.ProcessEnv = process.env,
): Effect.fn.Return<
  ServerProviderDraft,
  never,
  ChildProcessSpawner.ChildProcessSpawner | Crypto.Crypto
> {
  const checkedAt = DateTime.formatIso(yield* DateTime.now);
  const fallbackModels = metaModelsFromSettings(metaSettings.customModels);

  if (!metaSettings.enabled) {
    return buildServerProvider({
      presentation: META_PRESENTATION,
      enabled: false,
      checkedAt,
      models: fallbackModels,
      probe: {
        installed: false,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: "Meta is disabled in Modesto settings.",
      },
    });
  }

  const versionResult = yield* runMetaVersionCommand(metaSettings, environment).pipe(
    Effect.timeoutOption(VERSION_PROBE_TIMEOUT_MS),
    Effect.result,
  );

  if (Result.isFailure(versionResult)) {
    const error = versionResult.failure;
    yield* Effect.logWarning("Muse Code health check failed.", {
      errorTag: error._tag,
    });
    return buildServerProvider({
      presentation: META_PRESENTATION,
      enabled: metaSettings.enabled,
      checkedAt,
      models: fallbackModels,
      probe: {
        installed: !isCommandMissingCause(error),
        version: null,
        status: "error",
        auth: { status: "unknown" },
        message: isCommandMissingCause(error)
          ? "Muse Code (`muse`) is not installed or not on PATH."
          : "Failed to execute Muse Code health check.",
      },
    });
  }

  if (Option.isNone(versionResult.success)) {
    return buildServerProvider({
      presentation: META_PRESENTATION,
      enabled: metaSettings.enabled,
      checkedAt,
      models: fallbackModels,
      probe: {
        installed: true,
        version: null,
        status: "error",
        auth: { status: "unknown" },
        message: "Muse Code is installed but timed out while running `muse --version`.",
      },
    });
  }

  const versionOutput = versionResult.success.value;
  const version = parseGenericCliVersion(`${versionOutput.stdout}\n${versionOutput.stderr}`);
  if (versionOutput.code !== 0) {
    yield* Effect.logWarning("Muse Code version probe exited with a non-zero status.", {
      exitCode: versionOutput.code,
      stdoutLength: versionOutput.stdout.length,
      stderrLength: versionOutput.stderr.length,
    });
    return buildServerProvider({
      presentation: META_PRESENTATION,
      enabled: metaSettings.enabled,
      checkedAt,
      models: fallbackModels,
      probe: {
        installed: true,
        version,
        status: "error",
        auth: { status: "unknown" },
        message: "Muse Code is installed but failed to run.",
      },
    });
  }

  const discoveryExit = yield* discoverMetaModelsViaAcp(metaSettings, environment).pipe(
    Effect.timeoutOption(META_ACP_MODEL_DISCOVERY_TIMEOUT_MS),
    Effect.exit,
  );
  if (Exit.isFailure(discoveryExit)) {
    yield* Effect.logWarning("Meta ACP model discovery failed", {
      errorTag: causeErrorTag(discoveryExit.cause),
    });
    return buildServerProvider({
      presentation: META_PRESENTATION,
      enabled: metaSettings.enabled,
      checkedAt,
      models: fallbackModels,
      probe: {
        installed: true,
        version,
        status: "warning",
        auth: { status: "unknown" },
        message:
          "Muse Code is installed. ACP model discovery failed, so Modesto is using the Muse Spark catalog. Sessions need `muse --acp` (or set Binary path to an ACP adapter such as muse-acp).",
      },
    });
  }
  if (Option.isNone(discoveryExit.value)) {
    yield* Effect.logWarning(
      `Meta ACP model discovery timed out after ${META_ACP_MODEL_DISCOVERY_TIMEOUT_MS}ms.`,
    );
    return buildServerProvider({
      presentation: META_PRESENTATION,
      enabled: metaSettings.enabled,
      checkedAt,
      models: fallbackModels,
      probe: {
        installed: true,
        version,
        status: "warning",
        auth: { status: "unknown" },
        message: `Muse Code is installed. ACP startup timed out after ${META_ACP_MODEL_DISCOVERY_TIMEOUT_MS}ms, so Modesto is using the Muse Spark catalog.`,
      },
    });
  }
  const discoveredModels = discoveryExit.value.value;
  const models =
    discoveredModels.length > 0
      ? metaModelsFromSettings(metaSettings.customModels, discoveredModels)
      : fallbackModels;

  return buildServerProvider({
    presentation: META_PRESENTATION,
    enabled: metaSettings.enabled,
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

export const enrichMetaSnapshot = (input: {
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
      Effect.logWarning("Meta version advisory enrichment failed", {
        errorTag: causeErrorTag(cause),
      }),
    ),
    Effect.asVoid,
  );
};
