import { describe, expect, it } from "vite-plus/test";

import {
  AUTO_SELECT_DISCOVERED_MODEL_LIMIT,
  EMPTY_DRAFT,
  addModelsToDraft,
  applyDiscoveredModels,
  applyPresetToDraft,
  canSaveDraft,
  draftFromEndpoint,
  modelSuggestions,
} from "./ModelRoutersSection.logic";

describe("applyPresetToDraft", () => {
  it("fills connection details and keeps a key typed before picking the provider", () => {
    const draft = applyPresetToDraft({ ...EMPTY_DRAFT, apiKey: "nvapi-123" }, "nvidia");
    expect(draft).toMatchObject({
      presetId: "nvidia",
      label: "NVIDIA NIM",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      apiKey: "nvapi-123",
    });
  });

  it("clears connection details when switching to a custom endpoint", () => {
    const draft = applyPresetToDraft(applyPresetToDraft(EMPTY_DRAFT, "groq"), "custom");
    expect(draft).toMatchObject({ presetId: "custom", label: "", baseUrl: "" });
  });
});

describe("draftFromEndpoint", () => {
  it("recognizes the preset behind a saved endpoint", () => {
    const draft = draftFromEndpoint({
      id: "openrouter",
      label: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      wireApi: "chat",
      models: ["a"],
    });
    expect(draft.presetId).toBe("openrouter");
  });
});

describe("applyDiscoveredModels", () => {
  it("selects a small local catalog wholesale", () => {
    const draft = applyDiscoveredModels({ ...EMPTY_DRAFT, baseUrl: "http://127.0.0.1:11434/v1" }, [
      "llama3",
      "qwen3",
    ]);
    expect(draft.models).toEqual(["llama3", "qwen3"]);
    expect(draft.label).toBe("Ollama");
  });

  it("never bulk-selects a large hosted catalog", () => {
    const catalog = Array.from(
      { length: AUTO_SELECT_DISCOVERED_MODEL_LIMIT + 1 },
      (_, index) => `model-${index}`,
    );
    const draft = applyDiscoveredModels(applyPresetToDraft(EMPTY_DRAFT, "openrouter"), catalog);
    expect(draft.models).toEqual([]);
    expect(draft.availableModels).toHaveLength(catalog.length);
  });
});

describe("modelSuggestions", () => {
  it("filters by substring and hides already-chosen models", () => {
    const draft = {
      ...EMPTY_DRAFT,
      models: ["meta/llama-3.3-70b"],
      availableModels: ["meta/llama-3.3-70b", "meta/llama-4-maverick", "deepseek-r1"],
    };
    expect(modelSuggestions(draft, "LLAMA")).toEqual(["meta/llama-4-maverick"]);
  });
});

describe("addModelsToDraft", () => {
  it("splits pasted lists and dedupes", () => {
    const draft = addModelsToDraft({ ...EMPTY_DRAFT, models: ["a"] }, "a, b\nc");
    expect(draft.models).toEqual(["a", "b", "c"]);
  });
});

describe("canSaveDraft", () => {
  const hosted = { ...applyPresetToDraft(EMPTY_DRAFT, "nvidia"), models: ["m"] };

  it("requires a key and a model for a new hosted provider", () => {
    expect(canSaveDraft(hosted, false)).toBe(false);
    expect(canSaveDraft({ ...hosted, apiKey: "k" }, false)).toBe(true);
    expect(canSaveDraft({ ...hosted, apiKey: "k", models: [] }, false)).toBe(false);
  });

  it("accepts a previously saved key when editing", () => {
    expect(canSaveDraft(hosted, true)).toBe(true);
  });

  it("lets local and custom endpoints save without a key or models", () => {
    expect(canSaveDraft(applyPresetToDraft(EMPTY_DRAFT, "ollama"), false)).toBe(true);
    expect(
      canSaveDraft({ ...EMPTY_DRAFT, label: "vLLM", baseUrl: "http://127.0.0.1:8000/v1" }, false),
    ).toBe(true);
  });
});
