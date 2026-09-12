import type { CustomModelEndpointConfig, ServerProviderModel } from "@modesto/contracts";
import { assert, it } from "@effect/vitest";

import {
  appendCustomModelEndpointModels,
  applyPreferredCodexDefaultModel,
  isLegacyCodexModel,
  mapCodexModelCapabilities,
} from "./CodexProvider.ts";

it("keeps current Codex models out of legacy models", () => {
  assert.deepStrictEqual(
    [
      "gpt-5.6-luna",
      "gpt-5.6-terra",
      "gpt-5.6-sol",
      "gpt-daybreak-blue-latest",
      "gpt-daybreak-red-latest",
      "gpt-5.4",
    ].map((model) => [model, isLegacyCodexModel(model)]),
    [
      ["gpt-5.6-luna", false],
      ["gpt-5.6-terra", false],
      ["gpt-5.6-sol", false],
      ["gpt-daybreak-blue-latest", false],
      ["gpt-daybreak-red-latest", false],
      ["gpt-5.4", true],
    ],
  );
});

it("maps current Codex model capability fields", () => {
  const capabilities = mapCodexModelCapabilities({
    additionalSpeedTiers: [],
    defaultReasoningEffort: "super-high",
    description: "Test model",
    displayName: "GPT Test",
    hidden: false,
    id: "gpt-test",
    isDefault: true,
    model: "gpt-test",
    defaultServiceTier: "flex",
    serviceTiers: [
      {
        id: "priority",
        name: "Fast",
        description: "Lower latency responses.",
      },
      {
        id: "flex",
        name: "Flex",
        description: "Lower-cost asynchronous routing.",
      },
    ],
    supportedReasoningEfforts: [
      {
        description: "Maximum reasoning",
        reasoningEffort: "super-high",
      },
    ],
  });

  assert.deepStrictEqual(capabilities.optionDescriptors, [
    {
      id: "reasoningEffort",
      label: "Reasoning",
      type: "select",
      options: [{ id: "super-high", label: "super-high", isDefault: true }],
      currentValue: "super-high",
    },
    {
      id: "serviceTier",
      label: "Service Tier",
      type: "select",
      options: [
        { id: "default", label: "Standard" },
        {
          id: "priority",
          label: "Fast",
          description: "Lower latency responses.",
        },
        {
          id: "flex",
          label: "Flex",
          description: "Lower-cost asynchronous routing.",
          isDefault: true,
        },
      ],
      currentValue: "flex",
    },
  ]);
});

it("uses standard routing when the catalog has no default service tier", () => {
  const capabilities = mapCodexModelCapabilities({
    additionalSpeedTiers: ["fast"],
    defaultReasoningEffort: "medium",
    defaultServiceTier: null,
    description: "Test model",
    displayName: "GPT Test",
    hidden: false,
    id: "gpt-test",
    isDefault: true,
    model: "gpt-test",
    serviceTiers: [
      {
        id: "priority",
        name: "Fast",
        description: "1.5x speed, increased usage",
      },
    ],
    supportedReasoningEfforts: [],
  });

  assert.deepStrictEqual(capabilities.optionDescriptors, [
    {
      id: "serviceTier",
      label: "Service Tier",
      type: "select",
      options: [
        { id: "default", label: "Standard", isDefault: true },
        {
          id: "priority",
          label: "Fast",
          description: "1.5x speed, increased usage",
        },
      ],
      currentValue: "default",
    },
  ]);
});

it("marks the most preferred available model as default", () => {
  const models = applyPreferredCodexDefaultModel([
    { slug: "gpt-5.6-terra", name: "GPT-5.6-Terra", isCustom: false, capabilities: null },
    { slug: "gpt-5.4", name: "GPT-5.4", isCustom: false, isDefault: true, capabilities: null },
  ]);

  assert.deepStrictEqual(
    models.map((model) => ({ slug: model.slug, isDefault: model.isDefault })),
    [
      { slug: "gpt-5.6-terra", isDefault: true },
      { slug: "gpt-5.4", isDefault: undefined },
    ],
  );
});

it("prefers sol over terra when both are available", () => {
  const models = applyPreferredCodexDefaultModel([
    { slug: "gpt-5.6-terra", name: "GPT-5.6-Terra", isCustom: false, capabilities: null },
    { slug: "gpt-5.6-sol", name: "GPT-5.6-Sol", isCustom: false, capabilities: null },
  ]);

  assert.deepStrictEqual(models.find((model) => model.isDefault)?.slug, "gpt-5.6-sol");
});

it("keeps Codex's own default when no preferred model is available", () => {
  const models = applyPreferredCodexDefaultModel([
    { slug: "gpt-5.5", name: "GPT-5.5", isCustom: false, capabilities: null },
    { slug: "gpt-5.4", name: "GPT-5.4", isCustom: false, isDefault: true, capabilities: null },
  ]);

  assert.deepStrictEqual(models.find((model) => model.isDefault)?.slug, "gpt-5.4");
});

it("ignores custom models that shadow a preferred slug", () => {
  const models = applyPreferredCodexDefaultModel([
    { slug: "gpt-5.6-sol", name: "gpt-5.6-sol", isCustom: true, capabilities: null },
    { slug: "gpt-5.4", name: "GPT-5.4", isCustom: false, isDefault: true, capabilities: null },
  ]);

  assert.deepStrictEqual(models.find((model) => model.isDefault)?.slug, "gpt-5.4");
});

const baseModels: ReadonlyArray<ServerProviderModel> = [
  {
    slug: "gpt-5.6-sol",
    name: "gpt-5.6-sol",
    isCustom: false,
    isDefault: true,
    capabilities: null,
  },
];

function endpoint(overrides: Partial<CustomModelEndpointConfig>): CustomModelEndpointConfig {
  return {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    wireApi: "chat",
    models: [],
    ...overrides,
  };
}

it("appends each declared custom-endpoint model with a router:<endpointId>:<modelId> slug", () => {
  const models = appendCustomModelEndpointModels(baseModels, [
    endpoint({ models: ["meta-llama/Llama-3.3-70B-Instruct", "mixtral-8x7b"] }),
  ]);

  assert.deepStrictEqual(
    models.map((model) => [model.slug, model.name, model.subProvider, model.isCustom]),
    [
      ["gpt-5.6-sol", "gpt-5.6-sol", undefined, false],
      [
        "router:openrouter:meta-llama/Llama-3.3-70B-Instruct",
        "meta-llama/Llama-3.3-70B-Instruct",
        "OpenRouter",
        true,
      ],
      ["router:openrouter:mixtral-8x7b", "mixtral-8x7b", "OpenRouter", true],
    ],
  );
});

it("falls back to the endpoint's own label as a single model when none were declared", () => {
  const models = appendCustomModelEndpointModels([], [endpoint({ models: [] })]);

  assert.deepStrictEqual(
    models.map((model) => model.slug),
    ["router:openrouter:OpenRouter"],
  );
});

it("skips a custom-endpoint model slug that collides with an existing model", () => {
  const models = appendCustomModelEndpointModels(
    [{ slug: "router:openrouter:llama", name: "llama", isCustom: true, capabilities: null }],
    [endpoint({ models: ["llama"] })],
  );

  assert.deepStrictEqual(models.length, 1);
});

it("returns the input array unchanged when there are no custom model endpoints", () => {
  const models = appendCustomModelEndpointModels(baseModels, []);

  assert.strictEqual(models, baseModels);
});
