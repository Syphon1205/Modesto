import { describe, expect, it } from "vite-plus/test";

import {
  API_KEY_PROVIDER_PRESETS,
  apiKeyProviderPresetById,
  apiKeyProviderPresetForBaseUrl,
  apiKeyProviderPresetForLabel,
} from "./apiKeyProviders.ts";

describe("apiKeyProviderPresetForBaseUrl", () => {
  it("matches a preset by host and path prefix", () => {
    expect(apiKeyProviderPresetForBaseUrl("https://integrate.api.nvidia.com/v1")?.id).toBe(
      "nvidia",
    );
    expect(
      apiKeyProviderPresetForBaseUrl("https://openrouter.ai/api/v1/chat/completions/")?.id,
    ).toBe("openrouter");
  });

  it("does not match a different path on the same host", () => {
    expect(apiKeyProviderPresetForBaseUrl("https://openrouter.ai/other")).toBeUndefined();
  });

  it("only matches local presets on their default port", () => {
    expect(apiKeyProviderPresetForBaseUrl("http://127.0.0.1:11434/v1")?.id).toBe("ollama");
    expect(apiKeyProviderPresetForBaseUrl("http://127.0.0.1:8000/v1")).toBeUndefined();
  });

  it("returns undefined for unparseable input", () => {
    expect(apiKeyProviderPresetForBaseUrl("not a url")).toBeUndefined();
  });
});

describe("API_KEY_PROVIDER_PRESETS", () => {
  it("has unique ids that are valid custom endpoint ids", () => {
    const ids = API_KEY_PROVIDER_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9][a-z0-9_-]*$/);
      expect(apiKeyProviderPresetById(id)?.id).toBe(id);
    }
  });

  it("links every hosted preset to a key page", () => {
    for (const preset of API_KEY_PROVIDER_PRESETS) {
      expect(preset.requiresApiKey ? preset.keyUrl : "n/a").toBeTruthy();
    }
  });
});

describe("apiKeyProviderPresetForLabel", () => {
  it("matches a preset label case-insensitively", () => {
    expect(apiKeyProviderPresetForLabel(" nvidia nim ")?.id).toBe("nvidia");
    expect(apiKeyProviderPresetForLabel("My vLLM")).toBeUndefined();
  });
});
