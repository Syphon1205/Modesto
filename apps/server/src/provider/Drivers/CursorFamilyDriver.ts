// FILE: CursorFamilyDriver.ts
// Purpose: `ProviderDriver` factory for cursor-family CLI providers other
//          than Cursor itself - Kimi Code, Qwen Code and Poolside. Every one
//          of them needs the identical driver body (decode config, merge the
//          instance environment, build the adapter, build the managed
//          snapshot, declare manual-only maintenance), so the body lives here
//          once and each provider contributes only its descriptor and
//          settings schema.
//
//          Text generation is deliberately `UnsupportedTextGeneration`: the
//          primary Modesto tree wires no commit-message/PR/branch/title
//          generation for these three either, and inventing one against a CLI
//          nobody has verified would be worse than failing honestly.
// @module provider/Drivers/CursorFamilyDriver
import { type ProviderDriverKind, type ServerProvider } from "@modesto/contracts";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { HttpClient } from "effect/unstable/http";
import { ChildProcessSpawner } from "effect/unstable/process";

import * as BackgroundPolicy from "../../background/BackgroundPolicy.ts";
import { ServerConfig } from "../../config.ts";
import { ServerSettingsService } from "../../serverSettings.ts";
import { makeUnsupportedTextGeneration } from "../../textGeneration/UnsupportedTextGeneration.ts";
import { type CursorFamilyDescriptor, type CursorFamilySettings } from "../cursorFamily.ts";
import { ProviderDriverError } from "../Errors.ts";
import { makeCursorAdapter } from "../Layers/CursorAdapter.ts";
import {
  buildInitialCursorFamilyProviderSnapshot,
  checkCursorFamilyProviderStatus,
  enrichCursorFamilySnapshot,
} from "../Layers/CursorFamilyProvider.ts";
import { ProviderEventLoggers } from "../Layers/ProviderEventLoggers.ts";
import { makeManagedServerProvider } from "../makeManagedServerProvider.ts";
import {
  defaultProviderContinuationIdentity,
  type ProviderDriver,
  type ProviderInstance,
} from "../ProviderDriver.ts";
import { mergeProviderInstanceEnvironment } from "../ProviderInstanceEnvironment.ts";
import {
  makeManualOnlyProviderMaintenanceCapabilities,
  makeStaticProviderMaintenanceResolver,
  resolveProviderMaintenanceCapabilitiesEffect,
} from "../providerMaintenance.ts";
import type { ServerProviderDraft } from "../providerSnapshot.ts";
import {
  haveProviderSnapshotSettingsChanged,
  makeProviderSnapshotSettingsSource,
  type ProviderSnapshotSettings,
} from "../providerUpdateSettings.ts";

export type CursorFamilyDriverEnv =
  | BackgroundPolicy.BackgroundPolicy
  | ChildProcessSpawner.ChildProcessSpawner
  | Crypto.Crypto
  | FileSystem.FileSystem
  | HttpClient.HttpClient
  | Path.Path
  | ProviderEventLoggers
  | ServerConfig
  | ServerSettingsService;

const withInstanceIdentity =
  (input: {
    readonly driverKind: ProviderDriverKind;
    readonly instanceId: ProviderInstance["instanceId"];
    readonly displayName: string | undefined;
    readonly accentColor: string | undefined;
    readonly continuationGroupKey: string;
  }) =>
  (snapshot: ServerProviderDraft): ServerProvider => ({
    ...snapshot,
    instanceId: input.instanceId,
    driver: input.driverKind,
    ...(input.displayName ? { displayName: input.displayName } : {}),
    ...(input.accentColor ? { accentColor: input.accentColor } : {}),
    continuation: { groupKey: input.continuationGroupKey },
  });

/**
 * Build the `ProviderDriver` for one cursor-family member.
 *
 * `Settings` is the driver's own schema type; it only has to satisfy
 * `CursorFamilySettings` (enabled + binaryPath + optional customModels),
 * which every member's schema does by construction.
 */
export function makeCursorFamilyDriver<Settings extends CursorFamilySettings>(input: {
  readonly descriptor: CursorFamilyDescriptor;
  readonly configSchema: Schema.Codec<Settings, unknown>;
}): ProviderDriver<Settings, CursorFamilyDriverEnv> {
  const { descriptor, configSchema } = input;
  const decodeSettings = Schema.decodeSync(configSchema);
  // No package to auto-update: these CLIs each ship their own installer and
  // this tree does not run third-party installers (see CursorFamilyProvider.ts).
  const maintenance = makeStaticProviderMaintenanceResolver(
    makeManualOnlyProviderMaintenanceCapabilities({
      provider: descriptor.driverKind,
      packageName: null,
    }),
  );

  return {
    driverKind: descriptor.driverKind,
    metadata: {
      displayName: descriptor.displayName,
      supportsMultipleInstances: true,
    },
    configSchema,
    defaultConfig: (): Settings => decodeSettings({}),
    create: ({ instanceId, displayName, accentColor, environment, enabled, config }) =>
      Effect.gen(function* () {
        const crypto = yield* Crypto.Crypto;
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const httpClient = yield* HttpClient.HttpClient;
        const serverSettings = yield* ServerSettingsService;
        const eventLoggers = yield* ProviderEventLoggers;
        const processEnv = mergeProviderInstanceEnvironment(environment);
        const continuationIdentity = defaultProviderContinuationIdentity({
          driverKind: descriptor.driverKind,
          instanceId,
        });
        const stampIdentity = withInstanceIdentity({
          driverKind: descriptor.driverKind,
          instanceId,
          displayName,
          accentColor,
          continuationGroupKey: continuationIdentity.continuationKey,
        });
        const effectiveConfig = { ...config, enabled } satisfies CursorFamilySettings as Settings;
        const maintenanceCapabilities = yield* resolveProviderMaintenanceCapabilitiesEffect(
          maintenance,
          {
            binaryPath: effectiveConfig.binaryPath,
            env: processEnv,
          },
        );

        const adapter = yield* makeCursorAdapter(effectiveConfig, {
          family: descriptor,
          environment: processEnv,
          ...(eventLoggers.native ? { nativeEventLogger: eventLoggers.native } : {}),
          instanceId,
        });

        const checkProvider = checkCursorFamilyProviderStatus(
          descriptor,
          effectiveConfig,
          processEnv,
        ).pipe(
          Effect.map(stampIdentity),
          Effect.provideService(Crypto.Crypto, crypto),
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
        );

        const snapshotSettings = makeProviderSnapshotSettingsSource(
          effectiveConfig,
          serverSettings,
        );
        const snapshot = yield* makeManagedServerProvider<ProviderSnapshotSettings<Settings>>({
          maintenanceCapabilities,
          getSettings: snapshotSettings.getSettings,
          streamSettings: snapshotSettings.streamSettings,
          haveSettingsChanged: haveProviderSnapshotSettingsChanged,
          initialSnapshot: (settings) =>
            buildInitialCursorFamilyProviderSnapshot(descriptor, settings.provider).pipe(
              Effect.map(stampIdentity),
            ),
          checkProvider,
          enrichSnapshot: ({ settings, snapshot: currentSnapshot, publishSnapshot }) =>
            enrichCursorFamilySnapshot({
              descriptor,
              snapshot: currentSnapshot,
              maintenanceCapabilities,
              enableProviderUpdateChecks: settings.enableProviderUpdateChecks,
              publishSnapshot,
              httpClient,
            }),
        }).pipe(
          Effect.mapError(
            (cause) =>
              new ProviderDriverError({
                driver: descriptor.driverKind,
                instanceId,
                detail: `Failed to build ${descriptor.displayName} snapshot: ${cause.message ?? String(cause)}`,
                cause,
              }),
          ),
        );

        return {
          instanceId,
          driverKind: descriptor.driverKind,
          continuationIdentity,
          displayName,
          accentColor,
          enabled,
          snapshot,
          adapter,
          textGeneration: makeUnsupportedTextGeneration(descriptor.driverKind),
        } satisfies ProviderInstance;
      }),
  };
}
