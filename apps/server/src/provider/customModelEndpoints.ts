/**
 * customModelEndpoints - Shared metadata for user-defined OpenAI-compatible Codex
 * backends (vLLM, LM Studio, OpenRouter, Portkey, LiteLLM, etc).
 *
 * Definitions live in ServerSettings; the API key per endpoint goes through
 * ServerSecretStore, keyed by this module's naming convention, mirroring
 * providerCredentials.ts's per-provider key storage.
 *
 * @module customModelEndpoints
 */
const MAX_ID_LENGTH = 64;

export function customModelEndpointSecretName(id: string): string {
  return `customEndpointApiKey:${id}`;
}

// config.toml's `env_key` for this endpoint's `[model_providers.<id>]` section.
export function customModelEndpointEnvVar(id: string): string {
  return `MODESTO_CUSTOM_ENDPOINT_${id.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}_API_KEY`;
}

export function slugifyCustomModelEndpointId(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_ID_LENGTH);
  return slug.length > 0 ? slug : `endpoint-${Date.now().toString(36)}`;
}

// Appends a numeric suffix until `candidate` doesn't collide with `existingIds`,
// so two endpoints named "OpenRouter" don't fight over the same slug/section name.
export function uniqueCustomModelEndpointId(
  candidate: string,
  existingIds: ReadonlySet<string>,
): string {
  if (!existingIds.has(candidate)) {
    return candidate;
  }
  let suffix = 2;
  let next = `${candidate}-${suffix}`.slice(0, MAX_ID_LENGTH);
  while (existingIds.has(next)) {
    suffix += 1;
    next = `${candidate}-${suffix}`.slice(0, MAX_ID_LENGTH);
  }
  return next;
}
