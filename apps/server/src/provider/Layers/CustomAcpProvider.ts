// FILE: CustomAcpProvider.ts
// Purpose: Provider status probing for the "Custom ACP Agent" driver.
//          Deliberately does NOT execute the user's configured `command` to
//          probe a version the way every other driver's Provider.ts does
//          (e.g. `copilot --version`) - we don't know that an arbitrary
//          user-supplied binary even has a `--version` flag, and running an
//          unknown command with a guessed flag as a background health check
//          is not something to do without the user explicitly starting a
//          session. So this probe is configuration-only: "ready" once a
//          non-empty command is set, "warning" if the instance has nothing
//          configured yet. The real, live signal - whether the command
//          actually speaks ACP - only comes from actually starting a
//          session, exactly like a real custom-agent config in an editor's
//          ACP client (e.g. Zed's) works.
//
//          No model catalog: an arbitrary agent's model list (if any) is
//          unknown ahead of time, so there are no built-in models here at
//          all - only whatever the user adds via `customModels`, which stays
//          purely cosmetic labeling since this driver never sends a model
//          flag (see CustomAcpSupport.ts's header).
// @module provider/Layers/CustomAcpProvider

import {
  type CustomAcpSettings,
  type ModelCapabilities,
  type ServerProvider,
  type ServerProviderModel,
} from "@modesto/contracts";
import { causeErrorTag } from "@modesto/shared/observability";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { createModelCapabilities } from "@modesto/shared/model";
import { HttpClient } from "effect/unstable/http";

import {
  buildServerProvider,
  providerModelsFromSettings,
  type ServerProviderDraft,
} from "../providerSnapshot.ts";
import {
  enrichProviderSnapshotWithVersionAdvisory,
  type ProviderMaintenanceCapabilities,
} from "../providerMaintenance.ts";

const CUSTOM_ACP_PRESENTATION = {
  displayName: "Custom ACP Agent",
  showInteractionModeToggle: false,
  // No model concept exists for an arbitrary agent - see CustomAcpProvider.ts's
  // header - so there's nothing to restart or block on a model change either.
} as const;
const EMPTY_CAPABILITIES: ModelCapabilities = createModelCapabilities({
  optionDescriptors: [],
});

const CUSTOM_ACP_BUILT_IN_MODELS: ReadonlyArray<ServerProviderModel> = [];

function customAcpModelsFromSettings(
  customModels: ReadonlyArray<string> | undefined,
): ReadonlyArray<ServerProviderModel> {
  return providerModelsFromSettings(
    CUSTOM_ACP_BUILT_IN_MODELS,
    customModels ?? [],
    EMPTY_CAPABILITIES,
  );
}

function draftForSettings(
  customAcpSettings: CustomAcpSettings,
  checkedAt: string,
): ServerProviderDraft {
  const models = customAcpModelsFromSettings(customAcpSettings.customModels);

  if (!customAcpSettings.enabled) {
    return buildServerProvider({
      presentation: CUSTOM_ACP_PRESENTATION,
      enabled: false,
      checkedAt,
      models,
      probe: {
        installed: false,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: "This Custom ACP Agent instance is disabled.",
      },
    });
  }

  const command = customAcpSettings.command?.trim();
  if (!command) {
    return buildServerProvider({
      presentation: CUSTOM_ACP_PRESENTATION,
      enabled: true,
      checkedAt,
      models,
      probe: {
        installed: false,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: "No command configured yet. Set one in this instance's settings.",
      },
    });
  }

  return buildServerProvider({
    presentation: CUSTOM_ACP_PRESENTATION,
    enabled: true,
    checkedAt,
    models,
    probe: {
      installed: true,
      version: null,
      status: "ready",
      auth: { status: "unknown" },
      message: `Configured to run '${command}'. Not verified until a session starts.`,
    },
  });
}

export function buildInitialCustomAcpProviderSnapshot(
  customAcpSettings: CustomAcpSettings,
): Effect.Effect<ServerProviderDraft> {
  return Effect.gen(function* () {
    const checkedAt = yield* Effect.map(DateTime.now, DateTime.formatIso);
    return draftForSettings(customAcpSettings, checkedAt);
  });
}

export const checkCustomAcpProviderStatus = Effect.fn("checkCustomAcpProviderStatus")(function* (
  customAcpSettings: CustomAcpSettings,
): Effect.fn.Return<ServerProviderDraft> {
  const checkedAt = DateTime.formatIso(yield* DateTime.now);
  return draftForSettings(customAcpSettings, checkedAt);
});

export const enrichCustomAcpSnapshot = (input: {
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
      Effect.logWarning("Custom ACP Agent version advisory enrichment failed", {
        errorTag: causeErrorTag(cause),
      }),
    ),
    Effect.asVoid,
  );
};
