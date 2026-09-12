/**
 * customModelEndpoints - Shared metadata for user-defined OpenAI-compatible
 * backends (vLLM, LM Studio, OpenRouter, Portkey, LiteLLM, etc).
 *
 * Definitions live in ServerSettings; the API key per endpoint goes through
 * ServerSecretStore, keyed by this module's naming convention.
 *
 * Two providers consume these, through completely different native
 * mechanisms - there is no shared "custom endpoint" protocol to lean on:
 *
 * - **Codex** via `-c model_providers.<id>.*` app-server launch args, which
 *   is Codex CLI's own documented config surface. Its `wire_api` field is
 *   what the "Chat Completions" / "Responses" choice in the settings UI maps
 *   to. See `CodexAdapter.ts`.
 * - **OpenCode and Kilo** (Kilo forks OpenCode's config schema wholesale) via
 *   the `provider` block of `OPENCODE_CONFIG_CONTENT` / `KILO_CONFIG_CONTENT`.
 *   See `buildOpenCodeCustomProviderConfig` below.
 *
 * Every other driver here (Claude, Cursor, Grok, Copilot, Droid, Pi, Gemini,
 * Custom ACP Agent) has no native custom-endpoint mechanism at all, so custom
 * endpoints genuinely do not apply to them rather than being unimplemented.
 *
 * @module provider/customModelEndpoints
 */
import type { CustomModelEndpointConfig } from "@modesto/contracts";
import { CUSTOM_MODEL_ENDPOINT_MODEL_SLUG_PREFIX } from "@modesto/shared/customModelEndpoint";

const MAX_ID_LENGTH = 64;

export function customModelEndpointSecretName(id: string): string {
  return `customEndpointApiKey:${id}`;
}

// The `-c model_providers.<id>.env_key=...` value: names the env var Codex
// reads this endpoint's API key from at request time (see CodexAdapter.ts).
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

// Appends a numeric suffix until `candidate` doesn't collide with
// `existingIds`, so two endpoints named "OpenRouter" don't fight over the
// same slug/`-c model_providers.<id>` section name.
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

// Custom-endpoint models are appended to the Codex model list (see
// `appendCustomModelEndpointModels` in CodexProvider.ts) with a slug of the
// form `router:<endpointId>:<modelId>`, so the existing generic
// picker-rendering pipeline shows them for free - no new model-listing code
// needed. The web client also recognizes the `router:` prefix on its own
// (via `@modesto/shared/customModelEndpoint`, the shared source of truth for
// the prefix) to group these into a dedicated rail entry in the picker -
// see `ModelPickerContent.tsx`'s `customEndpointEntries`. `CodexAdapter.ts`
// parses the full slug back out at session-start time to decide which
// `-c model_providers.<id>.*` args to inject.
export function customModelEndpointModelSlug(endpointId: string, modelId: string): string {
  return `${CUSTOM_MODEL_ENDPOINT_MODEL_SLUG_PREFIX}${endpointId}:${modelId}`;
}

// Matches `modelSlug` against each candidate endpoint id's own prefix (rather
// than blindly splitting on ":") so a model id containing a colon can never
// be misparsed as an endpoint boundary.
export function parseCustomModelEndpointModelSlug(
  modelSlug: string,
  endpointIds: Iterable<string>,
): { readonly endpointId: string; readonly modelId: string } | undefined {
  if (!modelSlug.startsWith(CUSTOM_MODEL_ENDPOINT_MODEL_SLUG_PREFIX)) {
    return undefined;
  }
  const rest = modelSlug.slice(CUSTOM_MODEL_ENDPOINT_MODEL_SLUG_PREFIX.length);
  for (const endpointId of endpointIds) {
    const prefix = `${endpointId}:`;
    if (rest.startsWith(prefix)) {
      return { endpointId, modelId: rest.slice(prefix.length) };
    }
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* OpenCode / Kilo                                                            */
/* -------------------------------------------------------------------------- */

/**
 * OpenCode resolves a provider's wire protocol from the npm package named in
 * `provider.<id>.npm`, so the same "Chat Completions" / "Responses" choice
 * Codex expresses as `wire_api` maps onto a package choice here. Both values
 * are taken from OpenCode's own docs (`packages/web/src/content/docs/`):
 * `@ai-sdk/openai-compatible` serves `/chat/completions`, `@ai-sdk/openai`
 * serves `/responses`.
 */
function openCodeNpmPackageForWireApi(wireApi: "chat" | "responses"): string {
  return wireApi === "responses" ? "@ai-sdk/openai" : "@ai-sdk/openai-compatible";
}

/**
 * Builds the `provider` block OpenCode/Kilo need to serve a custom endpoint,
 * shaped exactly like the custom-provider example in OpenCode's own docs:
 *
 * ```jsonc
 * { "provider": { "<id>": {
 *     "npm": "@ai-sdk/openai-compatible",
 *     "name": "Atomic Chat (local)",
 *     "options": { "baseURL": "http://127.0.0.1:1337/v1" },
 *     "models": { "<model-id>": { "name": "<model-name>" } } } } }
 * ```
 *
 * Endpoints with no declared models are skipped: OpenCode keys its catalog
 * off this `models` map (there is no discovery call), so an endpoint with an
 * empty map would register a provider that can never be selected. Codex has
 * no such constraint, which is why its side falls back to a single
 * label-named entry instead.
 *
 * Returns `undefined` when nothing is configured, so callers can leave the
 * user's own `OPENCODE_CONFIG_CONTENT` completely untouched.
 */
export function buildOpenCodeCustomProviderConfig(
  endpoints: ReadonlyArray<CustomModelEndpointConfig>,
  apiKeyByEndpointId: ReadonlyMap<string, string>,
): { readonly provider: Record<string, unknown> } | undefined {
  const provider: Record<string, unknown> = {};
  for (const endpoint of endpoints) {
    const models: Record<string, { readonly name: string }> = {};
    for (const rawModel of endpoint.models) {
      const modelId = rawModel.trim();
      if (modelId.length > 0) {
        models[modelId] = { name: modelId };
      }
    }
    if (Object.keys(models).length === 0) {
      continue;
    }
    const apiKey = apiKeyByEndpointId.get(endpoint.id);
    provider[endpoint.id] = {
      npm: openCodeNpmPackageForWireApi(endpoint.wireApi),
      name: endpoint.label,
      options: {
        baseURL: endpoint.baseUrl,
        // OpenAI-compatible servers that ignore auth (vLLM, LM Studio) still
        // expect the header to exist; the AI SDK omits it entirely when the
        // key is absent, which some of them reject.
        apiKey: apiKey && apiKey.length > 0 ? apiKey : "modesto-unused",
      },
      models,
    };
  }
  return Object.keys(provider).length === 0 ? undefined : { provider };
}

/**
 * Merges the custom-endpoint `provider` block into whatever base config the
 * user (or the inherited environment) already supplies, so configuring an
 * endpoint in Modesto never silently drops someone's own OpenCode providers,
 * models, or agents. A base value that isn't parseable JSON is passed through
 * untouched rather than replaced - clobbering a config we failed to
 * understand would be worse than not injecting.
 */
export function mergeOpenCodeCustomProviderConfig(
  baseConfigContent: string,
  customProviderConfig: { readonly provider: Record<string, unknown> } | undefined,
): string {
  if (!customProviderConfig) {
    return baseConfigContent;
  }
  let base: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(baseConfigContent);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return baseConfigContent;
    }
    base = parsed as Record<string, unknown>;
  } catch {
    return baseConfigContent;
  }
  const baseProvider = base["provider"];
  const mergedProvider =
    typeof baseProvider === "object" && baseProvider !== null && !Array.isArray(baseProvider)
      ? // The user's own entry wins on an id collision: their config file is
        // the more explicit statement of intent than a settings row.
        { ...customProviderConfig.provider, ...(baseProvider as Record<string, unknown>) }
      : customProviderConfig.provider;
  return JSON.stringify({ ...base, provider: mergedProvider });
}
