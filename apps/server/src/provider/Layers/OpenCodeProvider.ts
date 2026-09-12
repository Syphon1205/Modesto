import {
  type ModelCapabilities,
  type OpenCodeSettings,
  type ServerProviderModel,
  type ServerProviderSkill,
} from "@modesto/contracts";
import * as Cause from "effect/Cause";
import * as Data from "effect/Data";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { createModelCapabilities } from "@modesto/shared/model";
import { compareSemverVersions } from "@modesto/shared/semver";
import {
  buildServerProvider,
  nonEmptyTrimmed,
  parseGenericCliVersion,
  providerModelsFromSettings,
  type ServerProviderDraft,
} from "../providerSnapshot.ts";
import {
  OpenCodeRuntime,
  openCodeRuntimeErrorDetail,
  type OpenCodeInventory,
} from "../opencodeRuntime.ts";
import type { Agent, ProviderListResponse } from "@opencode-ai/sdk/v2";

/**
 * Every OpenCode-protocol-compatible driver (OpenCode itself, Kilo, and any
 * future one) shares this file's status-checking logic wholesale - the
 * protocol is identical, only the product name and CLI binary differ. A
 * label threaded through every entry point keeps every user-facing string
 * (presentation displayName, probe/error messages, "not installed" CLI
 * name, ...) naming the actual driver instead of hardcoding "OpenCode" for
 * drivers that only reuse its runtime.
 */
export interface OpenCodeCompatibleLabel {
  /** Product name for prose, e.g. "OpenCode" vs "Kilo". */
  readonly providerName: string;
  /** Lowercase CLI binary name for backtick code spans, e.g. "opencode" vs "kilo". */
  readonly binaryCommand: string;
  /**
   * Minimum accepted `--version` output, gated only when set. OpenCode and
   * Kilo version their CLIs independently (Kilo has shipped 7.x while
   * OpenCode's floor here is 1.14.19), so a fork's minimum must never be
   * assumed from OpenCode's - omit this until a real verified floor for
   * that fork is known, rather than gating on a guessed number.
   */
  readonly minimumVersion?: string;
}

const MINIMUM_OPENCODE_VERSION = "1.14.19";

export const OPENCODE_LABEL: OpenCodeCompatibleLabel = {
  providerName: "OpenCode",
  binaryCommand: "opencode",
  minimumVersion: MINIMUM_OPENCODE_VERSION,
};

function presentationFor(label: OpenCodeCompatibleLabel) {
  return { displayName: label.providerName, showInteractionModeToggle: false } as const;
}

class OpenCodeProbeError extends Data.TaggedError("OpenCodeProbeError")<{
  readonly cause: unknown;
  readonly detail: string;
}> {}

function normalizeProbeMessage(message: string): string | undefined {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (
    trimmed === "An error occurred in Effect.tryPromise" ||
    trimmed === "An error occurred in Effect.try"
  ) {
    return undefined;
  }
  return trimmed;
}

function normalizedErrorMessage(cause: unknown): string | undefined {
  if (cause instanceof OpenCodeProbeError) {
    return normalizeProbeMessage(cause.detail);
  }

  if (!(cause instanceof Error)) {
    return undefined;
  }

  return normalizeProbeMessage(cause.message);
}

function formatOpenCodeProbeError(input: {
  readonly cause: unknown;
  readonly isExternalServer: boolean;
  readonly serverUrl: string;
  readonly label: OpenCodeCompatibleLabel;
}): { readonly installed: boolean; readonly message: string } {
  const detail = normalizedErrorMessage(input.cause);
  const lower = detail?.toLowerCase() ?? "";
  const { providerName, binaryCommand } = input.label;

  if (input.isExternalServer) {
    if (
      lower.includes("401") ||
      lower.includes("403") ||
      lower.includes("unauthorized") ||
      lower.includes("forbidden")
    ) {
      return {
        installed: true,
        message: `${providerName} server rejected authentication. Check the server URL and password.`,
      };
    }

    if (
      lower.includes("econnrefused") ||
      lower.includes("enotfound") ||
      lower.includes("fetch failed") ||
      lower.includes("networkerror") ||
      lower.includes("timed out") ||
      lower.includes("timeout") ||
      lower.includes("socket hang up")
    ) {
      return {
        installed: true,
        message: `Couldn't reach the configured ${providerName} server at ${input.serverUrl}. Check that the server is running and the URL is correct.`,
      };
    }

    return {
      installed: true,
      message: detail ?? `Failed to connect to the configured ${providerName} server.`,
    };
  }

  if (lower.includes("enoent") || lower.includes("notfound")) {
    return {
      installed: false,
      message: `${providerName} CLI (\`${binaryCommand}\`) is not installed or not on PATH.`,
    };
  }

  if (lower.includes("quarantine")) {
    return {
      installed: true,
      message: `macOS is blocking the ${providerName} binary (quarantine). Run \`xattr -d com.apple.quarantine $(which ${binaryCommand})\` to fix this.`,
    };
  }

  if (lower.includes("invalid code signature") || lower.includes("corrupted")) {
    return {
      installed: true,
      message: `macOS killed the ${providerName} process due to an invalid code signature. The binary may be corrupted — try reinstalling ${providerName}.`,
    };
  }

  return {
    installed: true,
    message: detail
      ? `Failed to execute ${providerName} CLI health check: ${detail}`
      : `Failed to execute ${providerName} CLI health check.`,
  };
}

function titleCaseSlug(value: string): string {
  const segments: Array<string> = [];
  for (const segment of value.split(/[-_/]+/)) {
    if (segment.length > 0) {
      segments.push(segment.charAt(0).toUpperCase() + segment.slice(1));
    }
  }
  return segments.join(" ");
}

function inferDefaultVariant(
  providerID: string,
  variants: ReadonlyArray<string>,
): string | undefined {
  if (variants.length === 1) {
    return variants[0];
  }
  if (providerID === "anthropic" || providerID.startsWith("google")) {
    return variants.includes("high") ? "high" : undefined;
  }
  if (providerID === "openai" || providerID === "opencode") {
    return variants.includes("medium") ? "medium" : variants.includes("high") ? "high" : undefined;
  }
  return undefined;
}

function inferDefaultAgent(agents: ReadonlyArray<Agent>): string | undefined {
  return agents.find((agent) => agent.name === "build")?.name ?? agents[0]?.name ?? undefined;
}

const DEFAULT_OPENCODE_MODEL_CAPABILITIES: ModelCapabilities = createModelCapabilities({
  optionDescriptors: [],
});

function openCodeCapabilitiesForModel(input: {
  readonly providerID: string;
  readonly model: ProviderListResponse["all"][number]["models"][string];
  readonly agents: ReadonlyArray<Agent>;
}): ModelCapabilities {
  const variantValues = Object.keys(input.model.variants ?? {});
  const defaultVariant = inferDefaultVariant(input.providerID, variantValues);
  const variantOptions = variantValues.map((value) =>
    defaultVariant === value
      ? { id: value, label: titleCaseSlug(value), isDefault: true as const }
      : { id: value, label: titleCaseSlug(value) },
  );
  const primaryAgents = input.agents.filter(
    (agent) => !agent.hidden && (agent.mode === "primary" || agent.mode === "all"),
  );
  const defaultAgent = inferDefaultAgent(primaryAgents);
  const agentOptions = primaryAgents.map((agent) =>
    defaultAgent === agent.name
      ? { id: agent.name, label: titleCaseSlug(agent.name), isDefault: true as const }
      : { id: agent.name, label: titleCaseSlug(agent.name) },
  );
  return createModelCapabilities({
    optionDescriptors: [
      ...(variantOptions.length > 0
        ? [
            {
              id: "variant",
              label: "Variant",
              type: "select" as const,
              options: variantOptions,
              ...(defaultVariant ? { currentValue: defaultVariant } : {}),
            },
          ]
        : []),
      ...(agentOptions.length > 0
        ? [
            {
              id: "agent",
              label: "Agent",
              type: "select" as const,
              options: agentOptions,
              ...(defaultAgent ? { currentValue: defaultAgent } : {}),
            },
          ]
        : []),
    ],
  });
}

function flattenOpenCodeModels(input: OpenCodeInventory): ReadonlyArray<ServerProviderModel> {
  const connected = new Set(input.providerList.connected);
  const models: Array<ServerProviderModel> = [];

  for (const provider of input.providerList.all) {
    if (!connected.has(provider.id)) {
      continue;
    }

    for (const model of Object.values(provider.models)) {
      const name = nonEmptyTrimmed(model.name);
      if (!name) {
        continue;
      }

      const subProvider = nonEmptyTrimmed(provider.name);
      models.push({
        slug: `${provider.id}/${model.id}`,
        name,
        ...(subProvider ? { subProvider } : {}),
        isCustom: false,
        capabilities: openCodeCapabilitiesForModel({
          providerID: provider.id,
          model,
          agents: input.agents,
        }),
      });
    }
  }

  return models.toSorted((left, right) => left.name.localeCompare(right.name));
}

function trimOptional(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function flattenOpenCodeSkills(input: OpenCodeInventory): ReadonlyArray<ServerProviderSkill> {
  const skills: ServerProviderSkill[] = [];
  for (const skill of input.skills ?? []) {
    const name = trimOptional(skill.name);
    const path = trimOptional(skill.location);
    if (!name || !path) {
      continue;
    }

    const description = trimOptional(skill.description);
    skills.push({
      name,
      path,
      enabled: true,
      ...(description ? { description, shortDescription: description } : {}),
    });
  }

  return skills.toSorted((left, right) => left.name.localeCompare(right.name));
}

export const makePendingOpenCodeProvider = (
  openCodeSettings: OpenCodeSettings,
  label: OpenCodeCompatibleLabel = OPENCODE_LABEL,
): Effect.Effect<ServerProviderDraft> =>
  Effect.gen(function* () {
    const checkedAt = yield* Effect.map(DateTime.now, DateTime.formatIso);
    const models = providerModelsFromSettings(
      [],
      openCodeSettings.customModels,
      DEFAULT_OPENCODE_MODEL_CAPABILITIES,
    );
    const presentation = presentationFor(label);

    if (!openCodeSettings.enabled) {
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
          message:
            openCodeSettings.serverUrl.trim().length > 0
              ? `${label.providerName} is disabled in Modesto settings. A server URL is configured.`
              : `${label.providerName} is disabled in Modesto settings.`,
        },
      });
    }

    return buildServerProvider({
      presentation,
      enabled: true,
      checkedAt,
      models,
      probe: {
        installed: false,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: `${label.providerName} provider status has not been checked in this session yet.`,
      },
    });
  });

export const checkOpenCodeProviderStatus = Effect.fn("checkOpenCodeProviderStatus")(function* (
  openCodeSettings: OpenCodeSettings,
  cwd: string,
  environment?: NodeJS.ProcessEnv,
  label: OpenCodeCompatibleLabel = OPENCODE_LABEL,
): Effect.fn.Return<ServerProviderDraft, never, OpenCodeRuntime> {
  const openCodeRuntime = yield* OpenCodeRuntime;
  const resolvedEnvironment = environment ?? process.env;
  const checkedAt = DateTime.formatIso(yield* DateTime.now);
  const customModels = openCodeSettings.customModels;
  const isExternalServer = openCodeSettings.serverUrl.trim().length > 0;
  const presentation = presentationFor(label);

  const fallback = (cause: unknown, version: string | null = null) => {
    const failure = formatOpenCodeProbeError({
      cause,
      isExternalServer,
      serverUrl: openCodeSettings.serverUrl,
      label,
    });
    return buildServerProvider({
      presentation,
      enabled: openCodeSettings.enabled,
      checkedAt,
      models: providerModelsFromSettings([], customModels, DEFAULT_OPENCODE_MODEL_CAPABILITIES),
      probe: {
        installed: failure.installed,
        version,
        status: "error",
        auth: { status: "unknown" },
        message: failure.message,
      },
    });
  };

  if (!openCodeSettings.enabled) {
    return buildServerProvider({
      presentation,
      enabled: false,
      checkedAt,
      models: providerModelsFromSettings([], customModels, DEFAULT_OPENCODE_MODEL_CAPABILITIES),
      probe: {
        installed: false,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: isExternalServer
          ? `${label.providerName} is disabled in Modesto settings. A server URL is configured.`
          : `${label.providerName} is disabled in Modesto settings.`,
      },
    });
  }

  let version: string | null = null;
  if (!isExternalServer) {
    const versionExit = yield* Effect.exit(
      openCodeRuntime
        .runOpenCodeCommand({
          binaryPath: openCodeSettings.binaryPath,
          args: ["--version"],
          environment: resolvedEnvironment,
        })
        .pipe(
          Effect.mapError(
            (cause) => new OpenCodeProbeError({ cause, detail: openCodeRuntimeErrorDetail(cause) }),
          ),
        ),
    );
    if (versionExit._tag === "Failure") {
      return fallback(Cause.squash(versionExit.cause));
    }
    version = parseGenericCliVersion(versionExit.value.stdout) ?? null;

    if (!version) {
      return fallback(
        new Error(
          `Unable to determine ${label.providerName} version from \`${label.binaryCommand} --version\` output.${label.minimumVersion ? ` Modesto requires ${label.providerName} v${label.minimumVersion} or newer.` : ""}`,
        ),
        null,
      );
    }
    if (label.minimumVersion && compareSemverVersions(version, label.minimumVersion) < 0) {
      return buildServerProvider({
        presentation,
        enabled: openCodeSettings.enabled,
        checkedAt,
        models: providerModelsFromSettings([], customModels, DEFAULT_OPENCODE_MODEL_CAPABILITIES),
        probe: {
          installed: true,
          version,
          status: "error",
          auth: { status: "unknown" },
          message: `${label.providerName} v${version} is too old. Upgrade to v${label.minimumVersion} or newer.`,
        },
      });
    }
  }

  const inventoryExit = yield* Effect.exit(
    (isExternalServer
      ? Effect.scoped(
          Effect.gen(function* () {
            const server = yield* openCodeRuntime.connectToOpenCodeServer({
              binaryPath: openCodeSettings.binaryPath,
              serverUrl: openCodeSettings.serverUrl,
              environment: resolvedEnvironment,
            });
            return yield* openCodeRuntime.loadOpenCodeInventory(
              openCodeRuntime.createOpenCodeSdkClient({
                baseUrl: server.url,
                directory: cwd,
                ...(openCodeSettings.serverPassword
                  ? { serverPassword: openCodeSettings.serverPassword }
                  : {}),
              }),
            );
          }),
        )
      : openCodeRuntime.loadInventoryFromCli({
          binaryPath: openCodeSettings.binaryPath,
          cwd,
          environment: resolvedEnvironment,
        })
    ).pipe(
      Effect.mapError(
        (cause) => new OpenCodeProbeError({ cause, detail: openCodeRuntimeErrorDetail(cause) }),
      ),
    ),
  );
  if (inventoryExit._tag === "Failure") {
    return fallback(Cause.squash(inventoryExit.cause), version);
  }

  const models = providerModelsFromSettings(
    flattenOpenCodeModels(inventoryExit.value),
    customModels,
    DEFAULT_OPENCODE_MODEL_CAPABILITIES,
  );
  const skills = flattenOpenCodeSkills(inventoryExit.value);
  const connectedCount = inventoryExit.value.providerList.connected.length;
  return buildServerProvider({
    presentation,
    enabled: true,
    checkedAt,
    models,
    skills,
    probe: {
      installed: true,
      version,
      status: connectedCount > 0 ? "ready" : "warning",
      auth: {
        status: connectedCount > 0 ? "authenticated" : "unknown",
        // `type` stays the wire-level protocol family ("opencode" is the
        // actual auth mechanism both OpenCode and Kilo speak); `label` is
        // what the settings card actually renders, so it must say the
        // driver's own name, not "opencode", when this label is Kilo's.
        type: "opencode",
        label: label.providerName,
      },
      message:
        connectedCount > 0
          ? `${connectedCount} upstream provider${connectedCount === 1 ? "" : "s"} connected through ${isExternalServer ? `the configured ${label.providerName} server` : label.providerName}.`
          : isExternalServer
            ? `Connected to the configured ${label.providerName} server, but it did not report any connected upstream providers.`
            : `${label.providerName} is available, but it did not report any connected upstream providers.`,
    },
  });
});
