// FILE: cloudAgents.ts
// Purpose: Shared eligibility helpers for OpenClaw / Cloud Agents provider allowlists.
// Layer: Shared runtime utility (server + web)

import {
  DEFAULT_MODEL_BY_PROVIDER,
  MODEL_OPTIONS_BY_PROVIDER,
  type ModelSelection,
  type ProviderKind,
  type ServerSettings,
} from "@modesto/contracts";

export const CLOUD_AGENT_PROVIDERS = [
  "codex",
  "claudeAgent",
  "cursor",
  "gemini",
  "grok",
  "droid",
  "kilo",
  "opencode",
  "pi",
] as const satisfies ReadonlyArray<ProviderKind>;

/** Providers that can run incoming cloud/OpenClaw tasks right now. */
export function isCloudAgentProviderEnabled(
  providers: ServerSettings["providers"],
  provider: ProviderKind,
): boolean {
  return providers[provider]?.enabled !== false;
}

/**
 * Ordered list of providers offered in Cloud Agents / OpenClaw allowlists.
 * Always includes currently allowed providers so a newly disabled entry can be unchecked.
 */
export function listCloudAgentProviders(input: {
  readonly providers: ServerSettings["providers"];
  readonly providerOrder?: ReadonlyArray<ProviderKind>;
  readonly hiddenProviders?: ReadonlyArray<ProviderKind>;
  readonly currentlyAllowed?: ReadonlyArray<ProviderKind>;
}): ProviderKind[] {
  const hidden = new Set(input.hiddenProviders ?? []);
  const order =
    input.providerOrder && input.providerOrder.length > 0
      ? input.providerOrder
      : CLOUD_AGENT_PROVIDERS;
  const eligible = new Set<ProviderKind>();

  for (const provider of CLOUD_AGENT_PROVIDERS) {
    if (!isCloudAgentProviderEnabled(input.providers, provider)) continue;
    if (hidden.has(provider)) continue;
    eligible.add(provider);
  }
  for (const provider of input.currentlyAllowed ?? []) {
    eligible.add(provider);
  }

  const ordered: ProviderKind[] = [];
  const seen = new Set<ProviderKind>();
  for (const provider of order) {
    if (!eligible.has(provider) || seen.has(provider)) continue;
    seen.add(provider);
    ordered.push(provider);
  }
  for (const provider of CLOUD_AGENT_PROVIDERS) {
    if (!eligible.has(provider) || seen.has(provider)) continue;
    seen.add(provider);
    ordered.push(provider);
  }
  return ordered;
}

export function defaultCloudAgentModelSelection(provider: ProviderKind): ModelSelection {
  if (provider === "pi") {
    // Pi has no static built-ins; ACP discovery fills the live catalog.
    const piModels = MODEL_OPTIONS_BY_PROVIDER.pi as ReadonlyArray<{ readonly slug: string }>;
    return { provider, model: piModels[0]?.slug ?? "default" };
  }
  return { provider, model: DEFAULT_MODEL_BY_PROVIDER[provider] };
}

/** Drop allowlist entries whose provider is disabled in server settings. */
export function filterCloudAgentModelSelections(
  allowed: ReadonlyArray<ModelSelection>,
  providers: ServerSettings["providers"],
): ModelSelection[] {
  return allowed.filter((selection) =>
    isCloudAgentProviderEnabled(providers, selection.provider),
  );
}
