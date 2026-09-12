// FILE: DevinProvider.ts
// Purpose: Provider snapshot + health probe for Devin. Devin is cloud-only,
//          so unlike every other provider in this tree there is no binary to
//          probe and no version to report: "healthy" here means "this
//          instance has an API key and Devin's API answers us".
//
//          The probe calls `GET /sessions` (the documented list endpoint)
//          with a short timeout. A 401/403 comes back as an auth failure with
//          an actionable message; a missing key never hard-fails, it reports
//          "not authenticated" the way the CLI providers report "not
//          installed".
//
// Deliberately NOT ported from the primary tree: nothing. Its Devin health
// check is the same shape (key presence, then a single authenticated API
// call) - what differs is only where the key comes from: this tree reads the
// instance's own environment rather than a global credential store.
// @module provider/Layers/DevinProvider
import {
  type DevinSettings,
  type ModelCapabilities,
  type ServerProvider,
  type ServerProviderModel,
} from "@modesto/contracts";
import { causeErrorTag } from "@modesto/shared/observability";
import { createModelCapabilities } from "@modesto/shared/model";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { HttpClient } from "effect/unstable/http";

import {
  DEVIN_API_KEY_ENV,
  readDevinApiKey,
  resolveDevinApiBaseUrl,
  type DevinFetch,
} from "./DevinAdapter.ts";
import {
  enrichProviderSnapshotWithVersionAdvisory,
  type ProviderMaintenanceCapabilities,
} from "../providerMaintenance.ts";
import {
  buildServerProvider,
  providerModelsFromSettings,
  type ServerProviderDraft,
} from "../providerSnapshot.ts";

const DEVIN_PRESENTATION = {
  displayName: "Devin",
  badgeLabel: "Early Access",
  // Devin runs its own autonomy; Modesto has no Build/Plan switch to offer.
  showInteractionModeToggle: false,
  requiresNewThreadForModelChange: false,
} as const;

const EMPTY_CAPABILITIES: ModelCapabilities = createModelCapabilities({
  optionDescriptors: [],
});

const DEVIN_PROBE_TIMEOUT_MS = 8_000;

/**
 * Devin exposes no model catalog - the session runs whatever model Cognition
 * assigns - so the only models an instance ever has are the ones a user typed
 * into `customModels`.
 */
function devinModels(settings: DevinSettings): ReadonlyArray<ServerProviderModel> {
  return providerModelsFromSettings([], settings.customModels ?? [], EMPTY_CAPABILITIES);
}

export function buildInitialDevinProviderSnapshot(
  settings: DevinSettings,
): Effect.Effect<ServerProviderDraft> {
  return Effect.gen(function* () {
    const checkedAt = yield* Effect.map(DateTime.now, DateTime.formatIso);
    const models = devinModels(settings);

    if (!settings.enabled) {
      return buildServerProvider({
        presentation: DEVIN_PRESENTATION,
        enabled: false,
        checkedAt,
        models,
        probe: {
          installed: false,
          version: null,
          status: "warning",
          auth: { status: "unknown" },
          message: "Devin is disabled in Modesto settings.",
        },
      });
    }

    return buildServerProvider({
      presentation: DEVIN_PRESENTATION,
      enabled: true,
      checkedAt,
      models,
      probe: {
        installed: true,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: "Checking Devin API availability...",
      },
    });
  });
}

export const checkDevinProviderStatus = Effect.fn("checkDevinProviderStatus")(function* (
  settings: DevinSettings,
  environment: NodeJS.ProcessEnv = process.env,
  fetchImplementation: DevinFetch = fetch,
): Effect.fn.Return<ServerProviderDraft, never, never> {
  const checkedAt = DateTime.formatIso(yield* DateTime.now);
  const models = devinModels(settings);

  if (!settings.enabled) {
    return buildServerProvider({
      presentation: DEVIN_PRESENTATION,
      enabled: false,
      checkedAt,
      models,
      probe: {
        installed: false,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: "Devin is disabled in Modesto settings.",
      },
    });
  }

  const apiKey = readDevinApiKey(environment);
  if (!apiKey) {
    return buildServerProvider({
      presentation: DEVIN_PRESENTATION,
      enabled: true,
      checkedAt,
      models,
      probe: {
        // Devin is a hosted service: there is nothing to install, so the
        // provider is always "installed" and only ever unauthenticated.
        installed: true,
        version: null,
        status: "warning",
        auth: { status: "unauthenticated" },
        message: `Devin needs an API key. Add ${DEVIN_API_KEY_ENV} to this instance's environment in Settings.`,
      },
    });
  }

  const baseUrl = resolveDevinApiBaseUrl(settings);
  const probe = yield* Effect.tryPromise({
    try: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEVIN_PROBE_TIMEOUT_MS);
      try {
        const response = await fetchImplementation(`${baseUrl}/sessions?limit=1`, {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });
        return { status: response.status, ok: response.ok };
      } finally {
        clearTimeout(timeout);
      }
    },
    catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
  }).pipe(Effect.timeoutOption(DEVIN_PROBE_TIMEOUT_MS), Effect.result);

  if (Result.isFailure(probe)) {
    yield* Effect.logWarning("Devin API health check failed.", {
      detail: probe.failure.message,
    });
    return buildServerProvider({
      presentation: DEVIN_PRESENTATION,
      enabled: true,
      checkedAt,
      models,
      probe: {
        installed: true,
        version: null,
        status: "error",
        auth: { status: "unknown" },
        message: "Could not reach Devin's API. Check your network connection and try again.",
      },
    });
  }

  if (Option.isNone(probe.success)) {
    return buildServerProvider({
      presentation: DEVIN_PRESENTATION,
      enabled: true,
      checkedAt,
      models,
      probe: {
        installed: true,
        version: null,
        status: "error",
        auth: { status: "unknown" },
        message: `Devin's API did not respond within ${DEVIN_PROBE_TIMEOUT_MS}ms.`,
      },
    });
  }

  const { status, ok } = probe.success.value;
  if (status === 401 || status === 403) {
    return buildServerProvider({
      presentation: DEVIN_PRESENTATION,
      enabled: true,
      checkedAt,
      models,
      probe: {
        installed: true,
        version: null,
        status: "error",
        auth: { status: "unauthenticated" },
        message: `Devin rejected ${DEVIN_API_KEY_ENV} (HTTP ${status}). Check the key on this instance in Settings.`,
      },
    });
  }

  if (!ok) {
    return buildServerProvider({
      presentation: DEVIN_PRESENTATION,
      enabled: true,
      checkedAt,
      models,
      probe: {
        installed: true,
        version: null,
        status: "error",
        auth: { status: "unknown" },
        message: `Devin's API returned HTTP ${status}.`,
      },
    });
  }

  return buildServerProvider({
    presentation: DEVIN_PRESENTATION,
    enabled: true,
    checkedAt,
    models,
    probe: {
      installed: true,
      version: null,
      status: "ready",
      auth: { status: "authenticated", type: "api-key" },
      message: "Devin API key accepted. Sessions run in Devin's cloud.",
    },
  });
});

export const enrichDevinSnapshot = (input: {
  readonly snapshot: ServerProvider;
  readonly maintenanceCapabilities: ProviderMaintenanceCapabilities;
  readonly enableProviderUpdateChecks?: boolean;
  readonly publishSnapshot: (snapshot: ServerProvider) => Effect.Effect<void>;
  readonly httpClient: HttpClient.HttpClient;
}): Effect.Effect<void> => {
  const { snapshot, publishSnapshot } = input;

  // There is no local Devin build to advise an update for, but the shared
  // enrichment path is what publishes the settled snapshot, so Devin goes
  // through it too (its manual-only maintenance capabilities make the
  // advisory itself a no-op).
  return enrichProviderSnapshotWithVersionAdvisory(snapshot, input.maintenanceCapabilities, {
    enableProviderUpdateChecks: input.enableProviderUpdateChecks,
  }).pipe(
    Effect.provideService(HttpClient.HttpClient, input.httpClient),
    Effect.flatMap((enrichedSnapshot) => publishSnapshot(enrichedSnapshot)),
    Effect.catchCause((cause) =>
      Effect.logWarning("Devin snapshot enrichment failed", {
        errorTag: causeErrorTag(cause),
      }),
    ),
    Effect.asVoid,
  );
};
