import type { CustomModelEndpointConfig } from "@modesto/contracts";
import {
  apiKeyProviderPresetById,
  apiKeyProviderPresetForBaseUrl,
  type ApiKeyProviderPreset,
} from "@modesto/shared/apiKeyProviders";

export const CUSTOM_PRESET_VALUE = "custom";
const MAX_MODEL_SUGGESTIONS = 8;

export interface EndpointDraft {
  readonly id: string | null;
  /** A preset id from `API_KEY_PROVIDER_PRESETS`, or `CUSTOM_PRESET_VALUE`. */
  readonly presetId: string;
  readonly label: string;
  readonly baseUrl: string;
  readonly models: ReadonlyArray<string>;
  /** Full catalog from the last successful discovery, used for suggestions. */
  readonly availableModels: ReadonlyArray<string>;
  readonly apiKey: string;
}

export const EMPTY_DRAFT: EndpointDraft = {
  id: null,
  presetId: CUSTOM_PRESET_VALUE,
  label: "",
  baseUrl: "",
  models: [],
  availableModels: [],
  apiKey: "",
};

export function draftFromEndpoint(endpoint: CustomModelEndpointConfig): EndpointDraft {
  return {
    id: endpoint.id,
    presetId: apiKeyProviderPresetForBaseUrl(endpoint.baseUrl)?.id ?? CUSTOM_PRESET_VALUE,
    label: endpoint.label,
    baseUrl: endpoint.baseUrl,
    models: endpoint.models,
    availableModels: [],
    apiKey: "",
  };
}

/**
 * Switching preset replaces the connection details but keeps a typed key:
 * people often paste the key first and pick the provider second.
 */
export function applyPresetToDraft(draft: EndpointDraft, presetId: string): EndpointDraft {
  const preset = apiKeyProviderPresetById(presetId);
  if (!preset) {
    return { ...draft, presetId: CUSTOM_PRESET_VALUE, label: "", baseUrl: "" };
  }
  return {
    ...draft,
    presetId: preset.id,
    label: preset.label,
    baseUrl: preset.baseUrl,
    models: [],
    availableModels: [],
  };
}

export function draftPreset(draft: EndpointDraft): ApiKeyProviderPreset | undefined {
  return apiKeyProviderPresetById(draft.presetId);
}

export function inferEndpointLabel(baseUrl: string): string | null {
  const preset = apiKeyProviderPresetForBaseUrl(baseUrl);
  if (preset) return preset.label;
  try {
    const url = new URL(baseUrl);
    const value = `${url.hostname} ${url.pathname}`.toLocaleLowerCase();
    if (value.includes("ollama") || url.port === "11434") return "Ollama";
    if (value.includes("vllm") || url.port === "8000") return "vLLM";
    if (value.includes("lmstudio") || value.includes("lm-studio") || url.port === "1234") {
      return "LM Studio";
    }
    return url.hostname === "localhost" || url.hostname === "127.0.0.1"
      ? "Local models"
      : url.hostname;
  } catch {
    return null;
  }
}

/** Splits pasted `a, b` / newline lists; dedupes against what is already chosen. */
export function addModelsToDraft(draft: EndpointDraft, value: string): EndpointDraft {
  const additions = value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (additions.length === 0) return draft;
  return { ...draft, models: [...new Set([...draft.models, ...additions])] };
}

export function removeModelFromDraft(draft: EndpointDraft, model: string): EndpointDraft {
  return { ...draft, models: draft.models.filter((entry) => entry !== model) };
}

/**
 * Hosted catalogs run to hundreds of models (OpenRouter, NVIDIA), so discovery
 * never bulk-selects them into the picker. Small catalogs - typically a local
 * server with a handful of loaded models - are selected wholesale when nothing
 * was chosen yet, which is what someone running Ollama expects.
 */
export const AUTO_SELECT_DISCOVERED_MODEL_LIMIT = 12;

export function applyDiscoveredModels(
  draft: EndpointDraft,
  discovered: ReadonlyArray<string>,
): EndpointDraft {
  const shouldSelectAll =
    draft.models.length === 0 && discovered.length <= AUTO_SELECT_DISCOVERED_MODEL_LIMIT;
  return {
    ...draft,
    label: draft.label.trim() || inferEndpointLabel(draft.baseUrl) || "Custom endpoint",
    availableModels: discovered,
    models: shouldSelectAll ? discovered : draft.models,
  };
}

export function modelSuggestions(draft: EndpointDraft, query: string): ReadonlyArray<string> {
  const needle = query.trim().toLocaleLowerCase();
  const chosen = new Set(draft.models);
  const matches: string[] = [];
  for (const model of draft.availableModels) {
    if (chosen.has(model)) continue;
    if (needle && !model.toLocaleLowerCase().includes(needle)) continue;
    matches.push(model);
    if (matches.length >= MAX_MODEL_SUGGESTIONS) break;
  }
  return matches;
}

export function canSaveDraft(draft: EndpointDraft, hasSavedApiKey: boolean): boolean {
  if (!draft.label.trim() || !draft.baseUrl.trim()) return false;
  const preset = draftPreset(draft);
  if (!preset || preset.local) return true;
  // Saving a hosted preset without a model would make the server auto-select
  // its whole catalog; saving it without a key produces an endpoint that can
  // only ever 401.
  return draft.models.length > 0 && (draft.apiKey.trim().length > 0 || hasSavedApiKey);
}
