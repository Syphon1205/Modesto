// FILE: CursorFamilyProvider.ts
// Purpose: Provider snapshot + health probe shared by every cursor-family
//          CLI that is not Cursor itself - today Kimi Code, Qwen Code and
//          Poolside (see `provider/cursorFamily.ts` for what "cursor family"
//          means and why these three qualify).
//
//          Shape is GrokProvider.ts's, which is the closest existing
//          precedent in this tree: probe `<binary> --version`, then discover
//          models from a real ACP session's model state rather than from a
//          static catalog. That mirrors what the primary Modesto tree does
//          for these three providers, where each one drives the Cursor
//          adapter with `acpOnlyModelDiscovery: true` - i.e. deliberately
//          skipping Cursor's own `cursor/list_available_models` extension
//          call, which only Cursor's CLI implements.
//
// Deliberately NOT ported from the primary tree's ProviderHealth.ts (flagged
// rather than silently dropped):
//  - Install/upgrade orchestration (the `curl | bash` installers, the npm
//    package upgrade path, the homebrew formula for Qwen). This tree's ported
//    drivers all declare `makeManualOnlyProviderMaintenanceCapabilities`
//    instead, and these three follow that same convention.
//  - Auth *status* detection. The primary tree reports `authStatus: "unknown"`
//    for all three as well - a real ACP session remains the authoritative
//    check - so this is parity, not a regression.
// @module provider/Layers/CursorFamilyProvider
import {
  type ModelCapabilities,
  type ServerProvider,
  type ServerProviderModel,
} from "@modesto/contracts";
import { causeErrorTag } from "@modesto/shared/observability";
import { createModelCapabilities } from "@modesto/shared/model";
import { resolveSpawnCommand } from "@modesto/shared/shell";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { HttpClient } from "effect/unstable/http";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import type * as EffectAcpSchema from "effect-acp/schema";

import {
  resolveCursorFamilyBinaryPath,
  type CursorFamilyDescriptor,
  type CursorFamilySettings,
} from "../cursorFamily.ts";
import { makeCursorAcpRuntime } from "../acp/CursorAcpSupport.ts";
import {
  enrichProviderSnapshotWithVersionAdvisory,
  type ProviderMaintenanceCapabilities,
} from "../providerMaintenance.ts";
import {
  buildServerProvider,
  isCommandMissingCause,
  parseGenericCliVersion,
  providerModelsFromSettings,
  spawnAndCollect,
  type ServerProviderDraft,
} from "../providerSnapshot.ts";
import { resolveCursorAcpBaseModelId } from "./CursorProvider.ts";

const EMPTY_CAPABILITIES: ModelCapabilities = createModelCapabilities({
  optionDescriptors: [],
});

const VERSION_PROBE_TIMEOUT_MS = 4_000;
const ACP_MODEL_DISCOVERY_TIMEOUT_MS = 15_000;

function presentationFor(descriptor: CursorFamilyDescriptor) {
  return {
    displayName: descriptor.displayName,
    ...(descriptor.badgeLabel ? { badgeLabel: descriptor.badgeLabel } : {}),
    // These CLIs expose no ACP session-mode list Modesto can map onto
    // Build/Plan, so the toggle would be inert - same call Grok makes.
    showInteractionModeToggle: false,
    // Models are applied at `session/set_model` on a live session, so a model
    // change does not need a fresh thread.
    requiresNewThreadForModelChange: false,
  } as const;
}

function modelsFromSettings(
  settings: CursorFamilySettings,
  discovered: ReadonlyArray<ServerProviderModel> = [],
): ReadonlyArray<ServerProviderModel> {
  return providerModelsFromSettings(discovered, settings.customModels ?? [], EMPTY_CAPABILITIES);
}

function buildDiscoveredModels(
  modelState: EffectAcpSchema.SessionModelState | null | undefined,
): ReadonlyArray<ServerProviderModel> {
  if (!modelState || modelState.availableModels.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  return modelState.availableModels
    .map((model): ServerProviderModel | undefined => {
      const slug = resolveCursorAcpBaseModelId(model.modelId);
      if (!slug || slug === "default" || seen.has(slug)) {
        return undefined;
      }
      seen.add(slug);
      return {
        slug,
        name: model.name.trim() || slug,
        isCustom: false,
        capabilities: EMPTY_CAPABILITIES,
      };
    })
    .filter((model): model is ServerProviderModel => model !== undefined);
}

const discoverModelsViaAcp = (
  descriptor: CursorFamilyDescriptor,
  settings: CursorFamilySettings,
  environment: NodeJS.ProcessEnv = process.env,
) =>
  Effect.gen(function* () {
    const childProcessSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const acp = yield* makeCursorAcpRuntime({
      cursorSettings: settings,
      descriptor,
      environment,
      childProcessSpawner,
      cwd: process.cwd(),
      clientInfo: { name: "t3-code-provider-probe", version: "0.0.0" },
    });
    const started = yield* acp.start();
    return buildDiscoveredModels(started.sessionSetupResult.models);
  }).pipe(Effect.scoped);

const runVersionCommand = (
  descriptor: CursorFamilyDescriptor,
  settings: CursorFamilySettings,
  environment: NodeJS.ProcessEnv = process.env,
) =>
  Effect.gen(function* () {
    const command = resolveCursorFamilyBinaryPath(descriptor, settings.binaryPath);
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

export function buildInitialCursorFamilyProviderSnapshot(
  descriptor: CursorFamilyDescriptor,
  settings: CursorFamilySettings,
): Effect.Effect<ServerProviderDraft> {
  return Effect.gen(function* () {
    const checkedAt = yield* Effect.map(DateTime.now, DateTime.formatIso);
    const models = modelsFromSettings(settings);
    const presentation = presentationFor(descriptor);

    if (!settings.enabled) {
      return buildServerProvider({
        presentation,
        enabled: false,
        checkedAt,
        models,
        probe: {
          installed: false,
          version: null,
          status: "warning",
          auth: { status: "unknown" },
          message: `${descriptor.displayName} is disabled in Modesto settings.`,
        },
      });
    }

    return buildServerProvider({
      presentation,
      enabled: true,
      checkedAt,
      models,
      probe: {
        installed: true,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: `Checking ${descriptor.cliDisplayName} availability...`,
      },
    });
  });
}

export const checkCursorFamilyProviderStatus = Effect.fn("checkCursorFamilyProviderStatus")(
  function* (
    descriptor: CursorFamilyDescriptor,
    settings: CursorFamilySettings,
    environment: NodeJS.ProcessEnv = process.env,
  ): Effect.fn.Return<
    ServerProviderDraft,
    never,
    ChildProcessSpawner.ChildProcessSpawner | Crypto.Crypto
  > {
    const checkedAt = DateTime.formatIso(yield* DateTime.now);
    const presentation = presentationFor(descriptor);
    const fallbackModels = modelsFromSettings(settings);

    if (!settings.enabled) {
      return buildServerProvider({
        presentation,
        enabled: false,
        checkedAt,
        models: fallbackModels,
        probe: {
          installed: false,
          version: null,
          status: "warning",
          auth: { status: "unknown" },
          message: `${descriptor.displayName} is disabled in Modesto settings.`,
        },
      });
    }

    const versionResult = yield* runVersionCommand(descriptor, settings, environment).pipe(
      Effect.timeoutOption(VERSION_PROBE_TIMEOUT_MS),
      Effect.result,
    );

    if (Result.isFailure(versionResult)) {
      const error = versionResult.failure;
      yield* Effect.logWarning(`${descriptor.cliDisplayName} health check failed.`, {
        errorTag: error._tag,
      });
      return buildServerProvider({
        presentation,
        enabled: settings.enabled,
        checkedAt,
        models: fallbackModels,
        probe: {
          installed: !isCommandMissingCause(error),
          version: null,
          status: "error",
          auth: { status: "unknown" },
          message: isCommandMissingCause(error)
            ? `${descriptor.cliDisplayName} (\`${descriptor.defaultBinary}\`) is not installed or not on PATH.`
            : `Failed to execute ${descriptor.cliDisplayName} health check.`,
        },
      });
    }

    if (Option.isNone(versionResult.success)) {
      return buildServerProvider({
        presentation,
        enabled: settings.enabled,
        checkedAt,
        models: fallbackModels,
        probe: {
          installed: true,
          version: null,
          status: "error",
          auth: { status: "unknown" },
          message: `${descriptor.cliDisplayName} is installed but its version check timed out.`,
        },
      });
    }

    const versionOutput = versionResult.success.value;
    const version = parseGenericCliVersion(`${versionOutput.stdout}\n${versionOutput.stderr}`);
    if (versionOutput.code !== 0) {
      yield* Effect.logWarning(
        `${descriptor.cliDisplayName} version probe exited with a non-zero status.`,
        {
          exitCode: versionOutput.code,
          stdoutLength: versionOutput.stdout.length,
          stderrLength: versionOutput.stderr.length,
        },
      );
      return buildServerProvider({
        presentation,
        enabled: settings.enabled,
        checkedAt,
        models: fallbackModels,
        probe: {
          installed: true,
          version,
          status: "error",
          auth: { status: "unknown" },
          message: `${descriptor.cliDisplayName} is installed but failed to run.`,
        },
      });
    }

    // Model discovery needs a real ACP handshake. A failure here is NOT fatal
    // for these providers: unlike Cursor - whose parameterized model picker
    // depends on a working extension call - Kimi/Qwen/Poolside can still run
    // turns on their CLI's own default model. So the snapshot stays "ready",
    // reports the CLI's install/login hint, and simply carries whatever models
    // the user configured manually.
    const discoveryExit = yield* discoverModelsViaAcp(descriptor, settings, environment).pipe(
      Effect.timeoutOption(ACP_MODEL_DISCOVERY_TIMEOUT_MS),
      Effect.exit,
    );

    const readyMessage = descriptor.authHint
      ? `${descriptor.cliDisplayName} is installed. ${descriptor.authHint}`
      : `${descriptor.cliDisplayName} is installed.`;

    if (Exit.isFailure(discoveryExit)) {
      yield* Effect.logWarning(`${descriptor.displayName} ACP model discovery failed`, {
        errorTag: causeErrorTag(discoveryExit.cause),
      });
      return buildServerProvider({
        presentation,
        enabled: settings.enabled,
        checkedAt,
        models: fallbackModels,
        probe: {
          installed: true,
          version,
          status: "ready",
          auth: { status: "unknown" },
          message: `${readyMessage} Modesto could not read its model list over ACP; check server logs for details.`,
        },
      });
    }
    if (Option.isNone(discoveryExit.value)) {
      yield* Effect.logWarning(
        `${descriptor.displayName} ACP model discovery timed out after ${ACP_MODEL_DISCOVERY_TIMEOUT_MS}ms.`,
      );
      return buildServerProvider({
        presentation,
        enabled: settings.enabled,
        checkedAt,
        models: fallbackModels,
        probe: {
          installed: true,
          version,
          status: "ready",
          auth: { status: "unknown" },
          message: `${readyMessage} Reading its model list over ACP timed out after ${ACP_MODEL_DISCOVERY_TIMEOUT_MS}ms.`,
        },
      });
    }

    return buildServerProvider({
      presentation,
      enabled: settings.enabled,
      checkedAt,
      models: modelsFromSettings(settings, discoveryExit.value.value),
      probe: {
        installed: true,
        version,
        status: "ready",
        auth: { status: "unknown" },
        message: readyMessage,
      },
    });
  },
);

export const enrichCursorFamilySnapshot = (input: {
  readonly descriptor: CursorFamilyDescriptor;
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
      Effect.logWarning(`${input.descriptor.displayName} version advisory enrichment failed`, {
        errorTag: causeErrorTag(cause),
      }),
    ),
    Effect.asVoid,
  );
};
