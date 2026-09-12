import type { CustomModelEndpointConfig } from "@modesto/contracts";
import { assert, it } from "@effect/vitest";

import {
  buildOpenCodeCustomProviderConfig,
  customModelEndpointEnvVar,
  customModelEndpointModelSlug,
  mergeOpenCodeCustomProviderConfig,
  parseCustomModelEndpointModelSlug,
  slugifyCustomModelEndpointId,
  uniqueCustomModelEndpointId,
} from "./customModelEndpoints.ts";

function endpoint(overrides: Partial<CustomModelEndpointConfig>): CustomModelEndpointConfig {
  return {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    wireApi: "chat",
    models: ["llama-3.3-70b"],
    ...overrides,
  };
}

it("slugifies a label into a lowercase, hyphenated id", () => {
  assert.strictEqual(slugifyCustomModelEndpointId("OpenRouter (Prod)"), "openrouter-prod");
});

it("appends a numeric suffix to resolve an id collision", () => {
  const existingIds = new Set(["openrouter", "openrouter-2"]);
  assert.strictEqual(uniqueCustomModelEndpointId("openrouter", existingIds), "openrouter-3");
});

it("derives a per-endpoint env var name from the id", () => {
  assert.strictEqual(
    customModelEndpointEnvVar("openrouter-prod"),
    "MODESTO_CUSTOM_ENDPOINT_OPENROUTER_PROD_API_KEY",
  );
});

it("round-trips a model slug back into its endpoint id and model id", () => {
  const slug = customModelEndpointModelSlug("openrouter", "meta-llama/Llama-3.3-70B-Instruct");
  assert.strictEqual(slug, "router:openrouter:meta-llama/Llama-3.3-70B-Instruct");
  assert.deepStrictEqual(parseCustomModelEndpointModelSlug(slug, ["openrouter"]), {
    endpointId: "openrouter",
    modelId: "meta-llama/Llama-3.3-70B-Instruct",
  });
});

it("matches the configured endpoint id as a literal prefix, not by splitting on the first colon", () => {
  // A model id that itself contains a colon (e.g. some OpenRouter slugs) must
  // not be misparsed - the endpoint id is matched as a whole prefix, so only
  // colons after it are treated as part of the model id.
  const slug = customModelEndpointModelSlug("router-a", "vendor:model:v2");
  assert.deepStrictEqual(parseCustomModelEndpointModelSlug(slug, ["router-a", "router-a-2"]), {
    endpointId: "router-a",
    modelId: "vendor:model:v2",
  });
});

it("returns undefined for a slug that isn't a custom-endpoint model", () => {
  assert.strictEqual(parseCustomModelEndpointModelSlug("gpt-5.6-sol", ["openrouter"]), undefined);
});

it("returns undefined when the slug's endpoint id isn't among the known ids", () => {
  const slug = customModelEndpointModelSlug("deleted-endpoint", "some-model");
  assert.strictEqual(parseCustomModelEndpointModelSlug(slug, ["openrouter"]), undefined);
});

/* -------------------------------------------------------------------------- */
/* OpenCode / Kilo custom provider config                                     */
/* -------------------------------------------------------------------------- */

it("builds an OpenCode provider block matching OpenCode's documented shape", () => {
  const config = buildOpenCodeCustomProviderConfig(
    [endpoint({ models: ["llama-3.3-70b", "mixtral-8x7b"] })],
    new Map([["openrouter", "sk-real-key"]]),
  );

  assert.deepStrictEqual(config, {
    provider: {
      openrouter: {
        npm: "@ai-sdk/openai-compatible",
        name: "OpenRouter",
        options: { baseURL: "https://openrouter.ai/api/v1", apiKey: "sk-real-key" },
        models: {
          "llama-3.3-70b": { name: "llama-3.3-70b" },
          "mixtral-8x7b": { name: "mixtral-8x7b" },
        },
      },
    },
  });
});

it("maps the Responses wire API onto OpenCode's @ai-sdk/openai package", () => {
  const config = buildOpenCodeCustomProviderConfig([endpoint({ wireApi: "responses" })], new Map());
  assert.ok(config);

  assert.strictEqual(
    (config.provider["openrouter"] as { readonly npm: string }).npm,
    "@ai-sdk/openai",
  );
});

it("substitutes a placeholder key so auth-less local servers still get the header", () => {
  const config = buildOpenCodeCustomProviderConfig([endpoint({})], new Map());
  assert.ok(config);

  assert.strictEqual(
    (config.provider["openrouter"] as { readonly options: { readonly apiKey: string } }).options
      .apiKey,
    "modesto-unused",
  );
});

it("skips an endpoint with no declared models", () => {
  // OpenCode keys its catalog off the `models` map with no discovery call, so
  // registering a provider with an empty map yields something unselectable.
  assert.strictEqual(
    buildOpenCodeCustomProviderConfig([endpoint({ models: [] })], new Map()),
    undefined,
  );
});

it("leaves the base config untouched when nothing is configured", () => {
  assert.strictEqual(
    mergeOpenCodeCustomProviderConfig('{"model":"x"}', undefined),
    '{"model":"x"}',
  );
});

it("merges into an existing config without dropping unrelated keys", () => {
  const merged = mergeOpenCodeCustomProviderConfig(
    JSON.stringify({ model: "anthropic/claude", agent: { build: {} } }),
    buildOpenCodeCustomProviderConfig([endpoint({})], new Map()),
  );

  const parsed = JSON.parse(merged) as Record<string, unknown>;
  assert.strictEqual(parsed["model"], "anthropic/claude");
  assert.deepStrictEqual(parsed["agent"], { build: {} });
  assert.ok(Object.hasOwn(parsed["provider"] as object, "openrouter"));
});

it("lets the user's own provider entry win an id collision", () => {
  const merged = mergeOpenCodeCustomProviderConfig(
    JSON.stringify({ provider: { openrouter: { name: "Mine" } } }),
    buildOpenCodeCustomProviderConfig([endpoint({})], new Map()),
  );

  const parsed = JSON.parse(merged) as { readonly provider: Record<string, { name: string }> };
  assert.strictEqual(parsed.provider["openrouter"]?.name, "Mine");
});

it("passes an unparseable base config through rather than clobbering it", () => {
  const base = "not json at all";
  assert.strictEqual(
    mergeOpenCodeCustomProviderConfig(
      base,
      buildOpenCodeCustomProviderConfig([endpoint({})], new Map()),
    ),
    base,
  );
});
