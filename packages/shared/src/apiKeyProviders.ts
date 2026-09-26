/**
 * apiKeyProviders - Catalog of well-known hosted model APIs that speak the
 * OpenAI-compatible protocol and authenticate with a plain API key
 * (OpenRouter, NVIDIA NIM, Groq, ...), plus common local servers.
 *
 * These are not separate provider drivers: each preset just pre-fills a
 * custom model endpoint (Settings > Providers > Custom endpoints, see
 * `apps/server/src/provider/customModelEndpoints.ts`), so the user only has
 * to paste a key. Model ids are deliberately not hardcoded here - hosted
 * catalogs churn weekly, so the settings UI discovers them from the
 * provider's own `/models` route instead.
 *
 * `codexCompatible` records whether the API serves the Responses route,
 * which Codex's custom-provider transport requires. OpenCode and Kilo use
 * Chat Completions and work with every preset.
 *
 * @module apiKeyProviders
 */

export interface ApiKeyProviderPreset {
  /** Stable slug, also used as the default custom-endpoint id. */
  readonly id: string;
  readonly label: string;
  readonly baseUrl: string;
  /** Where the user creates an API key; absent for keyless local servers. */
  readonly keyUrl?: string;
  readonly requiresApiKey: boolean;
  readonly codexCompatible: boolean;
  readonly local?: boolean;
}

export const API_KEY_PROVIDER_PRESETS: ReadonlyArray<ApiKeyProviderPreset> = [
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keyUrl: "https://openrouter.ai/keys",
    requiresApiKey: true,
    codexCompatible: true,
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    keyUrl: "https://build.nvidia.com/settings/api-keys",
    requiresApiKey: true,
    codexCompatible: false,
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keyUrl: "https://console.groq.com/keys",
    requiresApiKey: true,
    codexCompatible: true,
  },
  {
    id: "xai",
    label: "xAI",
    baseUrl: "https://api.x.ai/v1",
    keyUrl: "https://console.x.ai",
    requiresApiKey: true,
    codexCompatible: true,
  },
  {
    id: "together",
    label: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    keyUrl: "https://api.together.ai/settings/api-keys",
    requiresApiKey: true,
    codexCompatible: false,
  },
  {
    id: "fireworks",
    label: "Fireworks AI",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    keyUrl: "https://fireworks.ai/account/api-keys",
    requiresApiKey: true,
    codexCompatible: false,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    keyUrl: "https://platform.deepseek.com/api_keys",
    requiresApiKey: true,
    codexCompatible: false,
  },
  {
    id: "mistral",
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    keyUrl: "https://console.mistral.ai/api-keys",
    requiresApiKey: true,
    codexCompatible: false,
  },
  {
    id: "cerebras",
    label: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    keyUrl: "https://cloud.cerebras.ai",
    requiresApiKey: true,
    codexCompatible: false,
  },
  {
    id: "moonshot",
    label: "Moonshot (Kimi)",
    baseUrl: "https://api.moonshot.ai/v1",
    keyUrl: "https://platform.moonshot.ai/console/api-keys",
    requiresApiKey: true,
    codexCompatible: false,
  },
  {
    id: "zai",
    label: "Z.ai (GLM)",
    baseUrl: "https://api.z.ai/api/paas/v4",
    keyUrl: "https://z.ai/manage-apikey/apikey-list",
    requiresApiKey: true,
    codexCompatible: false,
  },
  {
    id: "deepinfra",
    label: "DeepInfra",
    baseUrl: "https://api.deepinfra.com/v1/openai",
    keyUrl: "https://deepinfra.com/dash/api_keys",
    requiresApiKey: true,
    codexCompatible: false,
  },
  {
    id: "huggingface",
    label: "Hugging Face",
    baseUrl: "https://router.huggingface.co/v1",
    keyUrl: "https://huggingface.co/settings/tokens",
    requiresApiKey: true,
    codexCompatible: false,
  },
  {
    id: "ollama",
    label: "Ollama",
    baseUrl: "http://127.0.0.1:11434/v1",
    requiresApiKey: false,
    codexCompatible: true,
    local: true,
  },
  {
    id: "lmstudio",
    label: "LM Studio",
    baseUrl: "http://127.0.0.1:1234/v1",
    requiresApiKey: false,
    codexCompatible: true,
    local: true,
  },
];

function hostAndPath(value: string): { host: string; path: string } | null {
  try {
    const url = new URL(value.trim());
    return {
      host: url.host.toLocaleLowerCase(),
      path: url.pathname.replace(/\/+$/, "").toLocaleLowerCase(),
    };
  } catch {
    return null;
  }
}

/**
 * Matches a saved endpoint's base URL back to its preset. Hosted presets match
 * on host plus path prefix (so `.../v1/chat/completions` pasted by hand still
 * resolves); local presets only match their exact default host:port, since
 * any localhost server could be behind a user-entered URL.
 */
export function apiKeyProviderPresetForBaseUrl(baseUrl: string): ApiKeyProviderPreset | undefined {
  const target = hostAndPath(baseUrl);
  if (!target) return undefined;
  return API_KEY_PROVIDER_PRESETS.find((preset) => {
    const candidate = hostAndPath(preset.baseUrl);
    return (
      candidate !== null && candidate.host === target.host && target.path.startsWith(candidate.path)
    );
  });
}

export function apiKeyProviderPresetById(id: string): ApiKeyProviderPreset | undefined {
  return API_KEY_PROVIDER_PRESETS.find((preset) => preset.id === id);
}

/**
 * Surfaces that only see an endpoint's display label (the model picker rail
 * gets models, not endpoint configs) resolve the preset by label. Presets
 * save with their own label and hosted ones don't expose it for editing, so
 * this is exact for everything added through the preset flow.
 */
export function apiKeyProviderPresetForLabel(label: string): ApiKeyProviderPreset | undefined {
  const normalized = label.trim().toLocaleLowerCase();
  return API_KEY_PROVIDER_PRESETS.find((preset) => preset.label.toLocaleLowerCase() === normalized);
}
